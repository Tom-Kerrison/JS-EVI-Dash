import os
import json
import re
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from sqlalchemy import create_engine, text
from datetime import datetime
from dotenv import load_dotenv
import logging
import numpy as np
from langchain_openai import ChatOpenAI
from langchain_community.utilities import SQLDatabase
from langchain_experimental.sql import SQLDatabaseChain

load_dotenv()

class SafeJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if pd.isna(obj):
            return None
        if isinstance(obj, (np.floating, float)):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, (np.integer, int)):
            return int(obj)
        if isinstance(obj, (np.ndarray, list)):
            return obj.tolist() if isinstance(obj, np.ndarray) else obj
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)
    
    def encode(self, o):
        o = self._clean_object(o)
        return super().encode(o)
    
    def _clean_object(self, obj):
        if isinstance(obj, dict):
            return {k: self._clean_object(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._clean_object(item) for item in obj]
        elif isinstance(obj, float):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return obj
        elif pd.isna(obj):
            return None
        return obj

app = Flask(__name__)
CORS(app)
app.json_encoder = SafeJSONEncoder
app.config['JSON_SORT_KEYS'] = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
DB_URI = os.getenv('DB_URI')
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
FLASK_ENV = os.getenv('FLASK_ENV', 'development')

_openai_client = None
_engine = None
_sql_db = None
_db_chain = None

def get_openai_client():
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set")
        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client

def get_engine():
    global _engine
    if _engine is None:
        if not DB_URI:
            raise ValueError("DB_URI not set")
        _engine = create_engine(DB_URI)
    return _engine

def get_sql_db():
    global _sql_db
    if _sql_db is None:
        if not DB_URI:
            raise ValueError("DB_URI not set")
        try:
            _sql_db = SQLDatabase.from_uri(DB_URI)
            logger.info("✅ DB connected")
        except Exception as e:
            logger.error(f"❌ DB error: {str(e)}")
            raise
    return _sql_db

def get_db_chain():
    global _db_chain
    if _db_chain is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set")
        try:
            llm = ChatOpenAI(temperature=0, verbose=False, openai_api_key=OPENAI_API_KEY, model="gpt-3.5-turbo")
            sql_db = get_sql_db()
            _db_chain = SQLDatabaseChain.from_llm(llm, sql_db, verbose=False)
        except Exception as e:
            logger.error(f"❌ Chain init error: {str(e)}")
            raise
    return _db_chain

def execute_sql_with_chain(question):
    try:
        db_chain = get_db_chain()
        result = db_chain.run(question)
        return result, "success"
    except Exception as e:
        return f"Error: {str(e)[:200]}", "error"

def clean_nan_values(df):
    for col in df.columns:
        try:
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].apply(lambda x: None if (pd.isna(x) or (isinstance(x, float) and np.isinf(x))) else x)
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].astype(str).replace('NaT', None)
            elif df[col].dtype == 'object':
                df[col] = df[col].apply(lambda x: None if (pd.isna(x) or (isinstance(x, str) and (x == '' or x.lower() == 'nan'))) else x)
        except Exception as e:
            logger.warning(f"⚠️ Error cleaning {col}: {str(e)}")
    return df

# ============================================================================
# HISTORY TABLE SETUP
# ============================================================================

def ensure_history_tables():
    """Create chat_history, sql_queries, graph_queries and graph_memory tables if they don't exist."""
    try:
        with get_engine().connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id SERIAL PRIMARY KEY,
                    user_message TEXT NOT NULL,
                    assistant_response TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sql_queries (
                    id SERIAL PRIMARY KEY,
                    overarching_question TEXT NOT NULL,
                    sub_question TEXT NOT NULL,
                    sql_result TEXT,
                    success BOOLEAN NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS graph_queries (
                    id SERIAL PRIMARY KEY,
                    user_input_question TEXT NOT NULL,
                    queries TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS graph_memory (
                    id SERIAL PRIMARY KEY,
                    user_input TEXT NOT NULL,
                    sub_questions TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.commit()
            logger.info("✅ History tables ready")
    except Exception as e:
        logger.error(f"❌ Failed to create history tables: {str(e)}")

def get_recent_chat_history(limit=5):
    """Fetch the last N chat exchanges for memory context."""
    try:
        with get_engine().connect() as conn:
            result = conn.execute(text(f"""
                SELECT user_message, assistant_response, created_at
                FROM chat_history
                ORDER BY created_at DESC
                LIMIT {limit}
            """))
            rows = result.fetchall()
            # Reverse so oldest is first (chronological order)
            return list(reversed(rows))
    except Exception as e:
        logger.warning(f"⚠️ Could not fetch chat history: {str(e)}")
        return []

def save_chat_message(user_message, assistant_response):
    """Persist a chat exchange to chat_history."""
    try:
        with get_engine().connect() as conn:
            conn.execute(text("""
                INSERT INTO chat_history (user_message, assistant_response)
                VALUES (:user_msg, :assistant_msg)
            """), {"user_msg": user_message, "assistant_msg": assistant_response})
            conn.commit()
    except Exception as e:
        logger.warning(f"⚠️ Could not save chat message: {str(e)}")

def save_sql_queries(overarching_question, results_list):
    """Persist sub-questions and their results to sql_queries."""
    try:
        with get_engine().connect() as conn:
            for item in results_list:
                conn.execute(text("""
                    INSERT INTO sql_queries (overarching_question, sub_question, sql_result, success)
                    VALUES (:oq, :sq, :result, :success)
                """), {
                    "oq": overarching_question,
                    "sq": item.get("question", ""),
                    "result": str(item.get("result", ""))[:2000],
                    "success": item.get("status") == "success"
                })
            conn.commit()
    except Exception as e:
        logger.warning(f"⚠️ Could not save SQL queries: {str(e)}")

def save_graph_queries(user_question, questions_text):
    """Persist user question and generated viz questions to graph_queries table."""
    try:
        with get_engine().connect() as conn:
            conn.execute(text("""
                INSERT INTO graph_queries (user_input_question, queries)
                VALUES (:q, :queries)
            """), {"q": user_question, "queries": questions_text})
            conn.commit()
    except Exception as e:
        logger.warning(f"⚠️ Could not save graph_queries: {str(e)}")


def save_graph_memory(user_question, questions_text):
    """Persist last 5 sub-questions with disclaimer to graph_memory table."""
    try:
        lines = [l.strip() for l in questions_text.split('\n') if l.strip() and '(' in l]
        last5 = lines[-5:] if len(lines) >= 5 else lines
        disclaimer = "⚠️ DISCLAIMER: Generated visualization sub-questions. Use with caution.\n\n"
        sub_q_text = disclaimer + "\n".join(f"{i+1}. {q}" for i, q in enumerate(last5))
        with get_engine().connect() as conn:
            conn.execute(text("""
                INSERT INTO graph_memory (user_input, sub_questions)
                VALUES (:u, :s)
            """), {"u": user_question, "s": sub_q_text})
            conn.commit()
    except Exception as e:
        logger.warning(f"⚠️ Could not save graph_memory: {str(e)}")


def get_graph_chat_history(limit=20):
    """Return recent graph chat exchanges (user question + charts metadata)."""
    try:
        with get_engine().connect() as conn:
            result = conn.execute(text(f"""
                SELECT user_input_question, queries, created_at
                FROM graph_queries
                ORDER BY created_at ASC
                LIMIT {limit}
            """))
            rows = result.fetchall()
            return [
                {
                    "user_message": row[0],
                    "queries_text": row[1],
                    "created_at": row[2].isoformat() if row[2] else None
                }
                for row in rows
            ]
    except Exception as e:
        logger.warning(f"⚠️ Could not fetch graph history: {str(e)}")
        return []


def build_where_clause(regions=None, categories=None, customer_tenure=None,
                      customer_recency=None, 
                      total_transactions_min=None, total_transactions_max=None,
                      discount_min=None, discount_max=None, time_filter='all'):
    """Build WHERE clause from global filters"""
    conditions = []
    
    if regions and len(regions) > 0:
        region_list = "', '".join([r.replace("'", "''") for r in regions])
        conditions.append(f'"Region" IN (\'{region_list}\')')
    
    if categories and len(categories) > 0:
        cat_list = "', '".join([c.replace("'", "''") for c in categories])
        conditions.append(f'"Category" IN (\'{cat_list}\')')
    
    if customer_tenure and len(customer_tenure) > 0:
        tenure_list = "', '".join([t.replace("'", "''") for t in customer_tenure])
        conditions.append(f'"Customer Tenure" IN (\'{tenure_list}\')')
    
    if customer_recency and len(customer_recency) > 0:
        recency_list = "', '".join([r.replace("'", "''") for r in customer_recency])
        conditions.append(f'"Customer Recency" IN (\'{recency_list}\')')
    
    if total_transactions_min is not None and total_transactions_min > 0:
        conditions.append(f'"Total Customer Transactions" >= {int(total_transactions_min)}')
    
    if total_transactions_max is not None:
        conditions.append(f'"Total Customer Transactions" <= {int(total_transactions_max)}')
    
    if discount_min is not None and discount_min > 0:
        conditions.append(f'"Discount_Applied" >= {discount_min}')
    
    if discount_max is not None:
        conditions.append(f'"Discount_Applied" <= {discount_max}')
    
    if time_filter and time_filter != 'all':
        if time_filter == '1m':
            conditions.append("CAST(\"Transaction_Date\" AS TIMESTAMP) >= '2024-12-06'::timestamp - INTERVAL '1 month'")
        elif time_filter == '3m':
            conditions.append("CAST(\"Transaction_Date\" AS TIMESTAMP) >= '2024-12-06'::timestamp - INTERVAL '3 months'")
        elif time_filter == '6m':
            conditions.append("CAST(\"Transaction_Date\" AS TIMESTAMP) >= '2024-12-06'::timestamp - INTERVAL '6 months'")
        elif time_filter == '1y':
            conditions.append("CAST(\"Transaction_Date\" AS TIMESTAMP) >= '2024-12-06'::timestamp - INTERVAL '1 year'")
    
    if conditions:
        return "WHERE " + " AND ".join(conditions)
    return ""

def get_all_aggregated_data(regions=None, categories=None, customer_tenure=None,
                           customer_recency=None,
                           total_transactions_min=None, total_transactions_max=None,
                           discount_min=None, discount_max=None, time_filter='all'):
    try:
        with get_engine().connect() as conn:
            logger.info("📊 Fetching aggregated dashboard data...")
            
            main_where = build_where_clause(
                regions,
                categories,
                customer_tenure,
                customer_recency,
                total_transactions_min,
                total_transactions_max,
                discount_min,
                discount_max,
                time_filter
            )

            logger.info(f"✅ WHERE clause: {main_where[:100]}")
            
            kpi_query = text(f"""
                SELECT
                    SUM("Revenue") as total_revenue,
                    AVG("AOV") as avg_aov,
                    AVG("LTV") as avg_ltv,
                    AVG("CAC Percent") as avg_cac_percent,
                    AVG("ROAS") as avg_roas,
                    AVG("Customer Lifetime") as avg_lifetime
                FROM main
                {main_where}
            """)
            
            kpi_result = conn.execute(kpi_query).fetchone()
            kpis = {
                'totalRevenue': float(kpi_result[0]) if kpi_result[0] else 0,
                'avgAOV': float(kpi_result[1]) if kpi_result[1] else 0,
                'avgLTV': float(kpi_result[2]) if kpi_result[2] else 0,
                'avgCACPercent': float(kpi_result[3]) if kpi_result[3] else 0,
                'avgROAS': float(kpi_result[4]) if kpi_result[4] else 0,
                'avgLifetime': float(kpi_result[5]) if kpi_result[5] else 0,
            }
            logger.info(f"✅ KPIs calculated")
            
            monthly_query = text(f"""
                SELECT
                    TO_CHAR("Transaction_Date", 'YYYY-MM') as month,
                    SUM("Revenue") as revenue,
                    SUM("Lost Revenue") as lost_revenue,
                    AVG("CAC") as cac
                FROM main
                {main_where}
                GROUP BY month
                ORDER BY month ASC
            """)
            
            monthly_df = pd.read_sql_query(monthly_query, conn)
            monthly_df = clean_nan_values(monthly_df)
            monthly_df['month'] = pd.to_datetime(monthly_df['month']).dt.strftime('%b %Y')
            monthly_data = monthly_df.to_dict('records')
            
            region_query = text(f"""
                SELECT
                    "Region" as region,
                    COUNT(*) as count
                FROM main
                {main_where}
                GROUP BY "Region"
                ORDER BY count DESC
            """)
            
            region_df = pd.read_sql_query(region_query, conn)
            region_df = clean_nan_values(region_df)
            colors = ['#3b82f6', '#f97316', '#10b981', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444']
            region_df['fill'] = [colors[i % len(colors)] for i in range(len(region_df))]
            region_data = region_df[['region', 'count', 'fill']].to_dict('records')
            region_data = [{'name': r['region'], 'value': r['count'], 'fill': r['fill']} for r in region_data]
            
            category_monthly_query = text(f"""
                SELECT
                    TO_CHAR("Transaction_Date", 'YYYY-MM') as month,
                    "Category" as category,
                    COUNT(*) as volume
                FROM main
                {main_where}
                GROUP BY month, "Category"
                ORDER BY month ASC, category ASC
            """)
            
            category_monthly_df = pd.read_sql_query(category_monthly_query, conn)
            category_monthly_df = clean_nan_values(category_monthly_df)
            category_monthly_df['month'] = pd.to_datetime(category_monthly_df['month']).dt.strftime('%b %Y')
            
            category_monthly_pivoted = category_monthly_df.pivot_table(
                index='month',
                columns='category',
                values='volume',
                aggfunc='sum',
                fill_value=0
            ).reset_index()
            
            category_monthly_data = category_monthly_pivoted.to_dict('records')
            
            purchase_histogram_query = text(f"""
                SELECT
                    "Total Customer Transactions" as num_purchases,
                    COUNT(*) as customer_count
                FROM main
                {main_where}
                GROUP BY num_purchases
                ORDER BY num_purchases ASC
            """)
            
            histogram_df = pd.read_sql_query(purchase_histogram_query, conn)
            histogram_df = clean_nan_values(histogram_df)
            histogram_data = histogram_df.to_dict('records')
            
            aov_where = main_where
            if aov_where:
                aov_where += ' AND "Customer Days Since First Purchase" IS NOT NULL AND "AOV" IS NOT NULL AND "Customer Days Since First Purchase" >= 0'
            else:
                aov_where = 'WHERE "Customer Days Since First Purchase" IS NOT NULL AND "AOV" IS NOT NULL AND "Customer Days Since First Purchase" >= 0'
            
            aov_days_query = text(f"""
            SELECT
                FLOOR("Customer Days Since First Purchase" / 7.0) AS weeks_since_first,
                AVG("AOV") AS avg_aov
            FROM main
            {aov_where}
            GROUP BY weeks_since_first
            ORDER BY weeks_since_first ASC
            """)
            
            aov_days_df = pd.read_sql_query(aov_days_query, conn)
            aov_days_df = clean_nan_values(aov_days_df)
            aov_days_data = aov_days_df.to_dict('records')
            
            roas_category_query = text(f"""
                SELECT
                    "Category" as category,
                    AVG("ROAS") as avg_roas
                FROM main
                {main_where}
                GROUP BY "Category"
                ORDER BY avg_roas DESC
            """)
            
            roas_category_df = pd.read_sql_query(roas_category_query, conn)
            roas_category_df = clean_nan_values(roas_category_df)
            roas_category_data = roas_category_df.to_dict('records')
            
            regions_list_query = text('SELECT DISTINCT "Region" FROM main ORDER BY "Region"')
            regions_list = [row[0] for row in conn.execute(regions_list_query).fetchall()]
            
            categories_list_query = text('SELECT DISTINCT "Category" FROM main ORDER BY "Category"')
            categories_list = [row[0] for row in conn.execute(categories_list_query).fetchall()]
            
            tenure_list_query = text('SELECT DISTINCT "Customer Tenure" FROM main ORDER BY "Customer Tenure"')
            tenure_list = [row[0] for row in conn.execute(tenure_list_query).fetchall()]
            
            recency_list_query = text('SELECT DISTINCT "Customer Recency" FROM main ORDER BY "Customer Recency"')
            recency_list = [row[0] for row in conn.execute(recency_list_query).fetchall()]
            
            transactions_max_query = text('SELECT MAX("Total Customer Transactions") FROM main')
            transactions_max = float(conn.execute(transactions_max_query).fetchone()[0] or 50)
            
            discount_max_query = text('SELECT MAX("Discount_Applied") FROM main')
            discount_max_raw = float(conn.execute(discount_max_query).fetchone()[0] or 1.0)
            discount_max = round(discount_max_raw, 2)
            
            data = [{
                'kpis': kpis,
                'monthlyData': monthly_data,
                'regionData': region_data,
                'categoryMonthlyData': category_monthly_data,
                'histogramData': histogram_data,
                'aovDaysData': aov_days_data,
                'roasCategoryData': roas_category_data,
                'filterLists': {
                    'regions': regions_list,
                    'categories': categories_list,
                    'tenureList': tenure_list,
                    'recencyList': recency_list,
                    'transactionsMax': transactions_max,
                    'discountMax': discount_max
                }
            }]
            
            logger.info("✅ All data aggregated and ready")
            return data
            
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)[:50]}"
    
    return jsonify({
        'status': 'healthy',
        'database': db_status,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        regions = request.args.get('regions', '').split(',') if request.args.get('regions') else None
        categories = request.args.get('categories', '').split(',') if request.args.get('categories') else None
        customer_tenure = request.args.get('customerTenure', '').split(',') if request.args.get('customerTenure') else None
        customer_recency = request.args.get('customerRecency', '').split(',') if request.args.get('customerRecency') else None
        total_transactions_min = float(request.args.get('totalTransactionsMin', 0)) if request.args.get('totalTransactionsMin') else None
        total_transactions_max = float(request.args.get('totalTransactionsMax', 0)) if request.args.get('totalTransactionsMax') else None
        discount_min = float(request.args.get('discountMin', 0)) if request.args.get('discountMin') else None
        discount_max = float(request.args.get('discountMax', 0)) if request.args.get('discountMax') else None
        time_filter = request.args.get('timeFilter', 'all')
        
        if regions:
            regions = [r.strip() for r in regions if r.strip()]
            regions = regions if regions else None
        if categories:
            categories = [c.strip() for c in categories if c.strip()]
            categories = categories if categories else None
        if customer_tenure:
            customer_tenure = [t.strip() for t in customer_tenure if t.strip()]
            customer_tenure = customer_tenure if customer_tenure else None
        if customer_recency:
            customer_recency = [r.strip() for r in customer_recency if r.strip()]
            customer_recency = customer_recency if customer_recency else None
        
        data = get_all_aggregated_data(
            regions=regions,
            categories=categories,
            customer_tenure=customer_tenure,
            customer_recency=customer_recency,
            total_transactions_min=total_transactions_min if total_transactions_min and total_transactions_min > 0 else None,
            total_transactions_max=total_transactions_max if total_transactions_max and total_transactions_max > 0 else None,
            discount_min=discount_min if discount_min and discount_min > 0 else None,
            discount_max=discount_max if discount_max and discount_max > 0 else None,
            time_filter=time_filter
        )

        return app.response_class(
            response=json.dumps(data, cls=SafeJSONEncoder),
            status=200,
            mimetype='application/json'
        )
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/text/analyze', methods=['POST'])
def analyze_text():
    try:
        data = request.json
        user_message = data.get('user_message', '').strip()

        if not user_message:
            return jsonify({'success': False, 'error': 'No message'}), 400

        logger.info(f"🔍 Text: {user_message[:100]}")

        client = get_openai_client()

        # ── 1. Fetch last 5 chat history rows for memory context ──────────────
        history_rows = get_recent_chat_history(limit=5)
        memory_messages = []
        for row in history_rows:
            memory_messages.append({"role": "user", "content": row[0]})
            memory_messages.append({"role": "assistant", "content": row[1]})

        # ── 2. Generate sub-questions using memory context ────────────────────
        questions_response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a data analyst with memory of previous conversation turns. "
                        "Using prior context if relevant, generate 5-8 specific SQL-ready questions "
                        "to answer the user's query. Output ONLY JSON: {\"questions\": [...]}"
                    )
                },
                *memory_messages,
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=1000
        )

        response_text = questions_response.choices[0].message.content.strip()

        try:
            parsed = json.loads(response_text)
            questions_list = parsed.get("questions", [])
        except json.JSONDecodeError:
            questions_list = [
                q.strip().lstrip("•-*").strip()
                for q in response_text.split("\n")
                if q.strip() and not q.strip().startswith("#")
            ]

        logger.info(f"✅ Generated {len(questions_list)} questions")

        # ── 3. Execute each sub-question via SQL chain ────────────────────────
        results_list = []
        for i, question in enumerate(questions_list[:8], 1):
            try:
                result, status = execute_sql_with_chain(question)
                results_list.append({
                    "question_number": i,
                    "question": question,
                    "result": result,
                    "status": status
                })
            except Exception as e:
                results_list.append({
                    "question_number": i,
                    "question": question,
                    "result": f"Error: {str(e)[:200]}",
                    "status": "error"
                })

        # ── 4. Save sub-questions to sql_queries table ────────────────────────
        save_sql_queries(user_message, results_list)

        # ── 5. Generate summary using memory + results ────────────────────────
        results_json = json.dumps(results_list, indent=2, cls=SafeJSONEncoder)

        summary_response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful data analyst assistant having a conversation. "
                        "Using previous context if relevant, provide a clear, friendly, "
                        "conversational 2-4 sentence summary of the data findings. "
                        "Do not mention SQL or technical details — speak naturally to the user."
                    )
                },
                *memory_messages,
                {
                    "role": "user",
                    "content": (
                        f"The user asked: {user_message}\n\n"
                        f"Data results:\n{results_json}\n\n"
                        f"Summarise the key findings conversationally."
                    )
                }
            ],
            temperature=0.7,
            max_tokens=500
        )

        summary = summary_response.choices[0].message.content.strip()

        # ── 6. Save chat exchange to chat_history ─────────────────────────────
        save_chat_message(user_message, summary)

        return jsonify({
            'success': True,
            'summary': summary,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """Return recent chat history for the frontend to pre-populate."""
    try:
        limit = int(request.args.get('limit', 20))
        with get_engine().connect() as conn:
            result = conn.execute(text(f"""
                SELECT user_message, assistant_response, created_at
                FROM chat_history
                ORDER BY created_at ASC
                LIMIT {limit}
            """))
            rows = result.fetchall()
            history = [
                {
                    "user_message": row[0],
                    "assistant_response": row[1],
                    "created_at": row[2].isoformat() if row[2] else None
                }
                for row in rows
            ]
        return jsonify({'success': True, 'history': history})
    except Exception as e:
        logger.error(f"❌ History fetch error: {str(e)}")
        return jsonify({'success': False, 'error': str(e), 'history': []}), 500


@app.route('/api/graphs/history', methods=['GET'])
def get_graphs_history():
    """Return recent graph chat history for frontend pre-population."""
    try:
        history = get_graph_chat_history(limit=20)
        return jsonify({'success': True, 'history': history})
    except Exception as e:
        logger.error(f"❌ Graph history error: {str(e)}")
        return jsonify({'success': False, 'error': str(e), 'history': []}), 500


@app.route('/api/graphs/generate', methods=['POST'])
def generate_graphs():
    try:
        data = request.json
        user_message = data.get('user_message', '').strip()
        if not user_message:
            return jsonify({'success': False, 'error': 'No message'}), 400

        logger.info(f"📊 Graph request: {user_message[:100]}")
        client = get_openai_client()

        # ── Single prompt: questions + chart types + SQL in one call ─────────
        # This avoids two-step parsing failures. We ask for strict JSON output.
        prompt_response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": """You are a data analyst and PostgreSQL expert.

The database has a single table called main with these columns (use EXACTLY these names, always double-quoted):
"Transaction_Date", "Revenue", "Lost Revenue", "CAC", "AOV", "LTV", "ROAS",
"Category", "Region", "Customer Tenure", "Customer Recency",
"Total Customer Transactions", "Customer Days Since First Purchase",
"Discount_Applied", "CAC Percent", "Customer Lifetime"

Given a business question, respond with ONLY a JSON array (no markdown, no explanation) of up to 4 chart objects.
Each object must have exactly these keys:
- "title": short chart title string
- "chart_type": one of: line, bar, pie
- "sql": a valid PostgreSQL SELECT query against the table called main

SQL rules:
- Always double-quote column names: "Revenue", "Category", etc.
- Select exactly 2 columns: first is x-axis (label/group), second is y-axis (numeric value)
- Always use GROUP BY and aggregation (SUM, AVG, COUNT)
- For dates use: TO_CHAR("Transaction_Date", 'YYYY-MM') AS month
- LIMIT results to 15 rows max
- Do NOT use aliases that shadow column names
- The table name is: main (no quotes needed around table name)

Example output:
[
  {
    "title": "Monthly Revenue",
    "chart_type": "line",
    "sql": "SELECT TO_CHAR(\"Transaction_Date\", 'YYYY-MM') AS month, SUM(\"Revenue\") AS total_revenue FROM main GROUP BY month ORDER BY month ASC LIMIT 15"
  },
  {
    "title": "Revenue by Category",
    "chart_type": "bar",
    "sql": "SELECT \"Category\", SUM(\"Revenue\") AS total_revenue FROM main GROUP BY \"Category\" ORDER BY total_revenue DESC LIMIT 10"
  }
]

Respond with ONLY the JSON array. No markdown fences, no explanation."""
                },
                {"role": "user", "content": user_message}
            ],
            temperature=0.2,
            max_tokens=1500
        )

        raw = prompt_response.choices[0].message.content.strip()
        logger.info(f"📝 GPT raw response (first 500): {raw[:500]}")

        # Strip markdown fences if GPT added them despite instructions
        raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
        raw = re.sub(r'```\s*$', '', raw, flags=re.MULTILINE).strip()

        try:
            chart_specs = json.loads(raw)
            if not isinstance(chart_specs, list):
                raise ValueError("Expected a JSON array")
        except Exception as parse_err:
            logger.error(f"❌ JSON parse error: {parse_err}\nRaw: {raw[:300]}")
            return jsonify({'success': False, 'error': f'GPT returned invalid JSON: {str(parse_err)}', 'raw': raw[:500]}), 500

        logger.info(f"✅ Parsed {len(chart_specs)} chart specs")

        # ── Execute each SQL query ────────────────────────────────────────────
        charts = []
        try:
            with get_engine().connect() as conn:
                for spec in chart_specs:
                    title = spec.get('title', 'Chart')
                    chart_type = spec.get('chart_type', 'bar').lower().strip()
                    sql = spec.get('sql', '').strip()

                    if not sql:
                        charts.append({'title': title, 'chart_type': 'error', 'error': 'No SQL provided'})
                        continue

                    # Strip comments
                    sql_clean = re.sub(r'^\s*--.*?$', '', sql, flags=re.MULTILINE).strip()

                    if not sql_clean.upper().startswith('SELECT'):
                        charts.append({'title': title, 'chart_type': 'error', 'error': 'Only SELECT queries allowed'})
                        continue

                    logger.info(f"🔍 Executing SQL for '{title}': {sql_clean[:150]}")

                    try:
                        df = pd.read_sql_query(sql_clean, conn)
                        logger.info(f"✅ Query returned {len(df)} rows, columns: {list(df.columns)}")

                        if df.empty:
                            charts.append({'title': title, 'chart_type': 'error', 'error': 'Query returned no data'})
                            continue

                        if len(df.columns) < 2:
                            charts.append({'title': title, 'chart_type': 'error', 'error': f'Query returned only {len(df.columns)} column(s), need 2'})
                            continue

                        df = clean_nan_values(df)
                        x_col = df.columns[0]
                        y_col = df.columns[1]

                        # Convert numeric columns properly
                        try:
                            df[y_col] = pd.to_numeric(df[y_col], errors='coerce')
                            df = df.dropna(subset=[y_col])
                        except Exception:
                            pass

                        # Normalize chart types
                        if chart_type not in ['line', 'bar', 'pie', 'area', 'scatter', 'histogram']:
                            chart_type = 'bar'

                        records = df.to_dict('records')
                        # Convert any non-serialisable types
                        for r in records:
                            for k, v in r.items():
                                if hasattr(v, 'item'):  # numpy scalar
                                    r[k] = v.item()

                        charts.append({
                            'title': title,
                            'chart_type': chart_type,
                            'data': records,
                            'xKey': x_col,
                            'yKey': y_col
                        })

                    except Exception as sql_err:
                        err_msg = str(sql_err)[:300]
                        logger.error(f"❌ SQL execution error for '{title}': {err_msg}")
                        charts.append({'title': title, 'chart_type': 'error', 'error': err_msg})

        except Exception as db_err:
            logger.error(f"❌ DB connection error: {str(db_err)}")
            return jsonify({'success': False, 'error': f'Database error: {str(db_err)}'}), 500

        logger.info(f"✅ Returning {len(charts)} charts ({sum(1 for c in charts if c.get('chart_type') != 'error')} successful)")

        # ── Persist to DB ─────────────────────────────────────────────────────
        questions_text = "\n".join(f"{c['title']} ({c.get('chart_type','bar')})" for c in chart_specs)
        save_graph_queries(user_message, questions_text)
        save_graph_memory(user_message, questions_text)

        return jsonify({
            'success': True,
            'charts': charts,
            'questions_text': questions_text,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"❌ generate_graphs error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'success': False, 'error': 'Server error'}), 500

if __name__ == '__main__':
    logger.info(f"🚀 Starting API on port {FLASK_PORT}")
    logger.info("📡 GET /api/data")
    
    try:
        get_sql_db()
        logger.info("✅ DB ready")
    except Exception as e:
        logger.warning(f"⚠️ DB warning: {str(e)}")

    # Ensure history tables exist on startup
    try:
        ensure_history_tables()
    except Exception as e:
        logger.warning(f"⚠️ History table warning: {str(e)}")
    
    if FLASK_ENV == 'development':
        app.run(debug=True, host='0.0.0.0', port=FLASK_PORT)
    else:
        app.run(debug=False, host='0.0.0.0', port=FLASK_PORT)