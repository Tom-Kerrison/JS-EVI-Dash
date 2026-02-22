#!/usr/bin/env python3
"""
Comprehensive API Debugging Tool
Tests all endpoints and identifies issues
"""

import os
import sys
import requests
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect
import pandas as pd

load_dotenv()

print("\n" + "="*80)
print("🔍 COMPREHENSIVE API DEBUGGING TOOL")
print("="*80)

# ============================================================================
# CONFIGURATION CHECK
# ============================================================================
print("\n1️⃣ ENVIRONMENT CONFIGURATION")
print("-" * 80)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
DB_URI = os.getenv('DB_URI')
FLASK_PORT = os.getenv('FLASK_PORT', '5000')
FLASK_ENV = os.getenv('FLASK_ENV', 'development')

print(f"   OPENAI_API_KEY: {'✅ Set' if OPENAI_API_KEY else '❌ NOT SET'}")
if OPENAI_API_KEY:
    print(f"     Key preview: {OPENAI_API_KEY[:20]}...")
print(f"   DB_URI: {'✅ Set' if DB_URI else '❌ NOT SET'}")
if DB_URI:
    print(f"     URI preview: {DB_URI.split('@')[0]}@...")
print(f"   FLASK_PORT: {FLASK_PORT}")
print(f"   FLASK_ENV: {FLASK_ENV}")

if not OPENAI_API_KEY or not DB_URI:
    print("\n   ❌ Missing critical environment variables!")
    sys.exit(1)

# ============================================================================
# DATABASE CONNECTION CHECK
# ============================================================================
print("\n2️⃣ DATABASE CONNECTION")
print("-" * 80)

try:
    engine = create_engine(DB_URI)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("   ✅ Database connection successful")
    
    # Get tables
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"   📊 Total tables: {len(tables)}")
    for table in tables[:10]:
        print(f"      - {table}")
    if len(tables) > 10:
        print(f"      ... and {len(tables) - 10} more")
    
    # Check Main table
    if 'Main' in tables:
        print(f"   ✅ 'Main' table found")
        with engine.connect() as conn:
            count = conn.execute(text('SELECT COUNT(*) FROM "Main"')).scalar()
            print(f"      Rows: {count:,}")
            
            # Get column info
            cols = inspector.get_columns('Main')
            print(f"      Columns: {len(cols)}")
            for col in cols[:5]:
                print(f"         - {col['name']} ({col['type']})")
            if len(cols) > 5:
                print(f"         ... and {len(cols) - 5} more")
    else:
        print(f"   ❌ 'Main' table NOT found")
        print(f"      Available tables: {tables}")
        
except Exception as e:
    print(f"   ❌ Database error: {str(e)}")
    sys.exit(1)

# ============================================================================
# FLASK API HEALTH CHECK
# ============================================================================
print("\n3️⃣ FLASK API STATUS")
print("-" * 80)

flask_url = f"http://localhost:{FLASK_PORT}"

try:
    response = requests.get(f"{flask_url}/api/health", timeout=5)
    print(f"   Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ API is running")
        print(f"   Database Status: {data.get('database', 'unknown')}")
        print(f"   API Version: {data.get('api_version', 'unknown')}")
    else:
        print(f"   ❌ API returned error status")
        print(f"   Response: {response.text[:300]}")
except requests.exceptions.ConnectionError:
    print(f"   ❌ Cannot connect to Flask at {flask_url}")
    print(f"   Make sure Flask is running: python backend_graphs_updated.py")
    sys.exit(1)
except Exception as e:
    print(f"   ❌ Error: {str(e)}")
    sys.exit(1)

# ============================================================================
# TEST /api/data ENDPOINT
# ============================================================================
print("\n4️⃣ TEST /api/data ENDPOINT")
print("-" * 80)

try:
    print(f"   Making request to {flask_url}/api/data...")
    response = requests.get(f"{flask_url}/api/data", timeout=30)
    
    print(f"   Status Code: {response.status_code}")
    print(f"   Response Size: {len(response.text):,} bytes")
    
    if response.status_code == 200:
        try:
            data = response.json()
            
            if isinstance(data, list):
                print(f"   ✅ Response is JSON array")
                print(f"   Records: {len(data):,}")
                
                if len(data) > 0:
                    print(f"   ✅ Data exists!")
                    first_record = data[0]
                    print(f"   First record keys: {list(first_record.keys())[:10]}")
                    
                    # Count nulls
                    null_count = sum(1 for v in first_record.values() if v is None)
                    print(f"   Null values in first record: {null_count}/{len(first_record)}")
                else:
                    print(f"   ❌ Array is empty!")
            else:
                print(f"   ❌ Response is not array, got: {type(data)}")
                print(f"   First 200 chars: {str(data)[:200]}")
                
        except json.JSONDecodeError as je:
            print(f"   ❌ Response is not valid JSON")
            print(f"   First 500 chars: {response.text[:500]}")
    else:
        print(f"   ❌ API error: {response.status_code}")
        try:
            error_data = response.json()
            print(f"   Error: {json.dumps(error_data, indent=2)}")
        except:
            print(f"   Response: {response.text[:500]}")
            
except requests.exceptions.Timeout:
    print(f"   ❌ Request timed out (30s)")
    print(f"   Database query might be slow or stuck")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# ============================================================================
# TEST /api/text/analyze ENDPOINT
# ============================================================================
print("\n5️⃣ TEST /api/text/analyze ENDPOINT")
print("-" * 80)

try:
    payload = {
        'user_message': 'What are the top 5 products by sales?'
    }
    
    print(f"   Sending test query: {payload['user_message']}")
    response = requests.post(
        f"{flask_url}/api/text/analyze",
        json=payload,
        timeout=60
    )
    
    print(f"   Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print(f"   ✅ Analysis successful")
            print(f"   Summary: {data.get('summary', '')[:200]}...")
            print(f"   Questions: {len(data.get('questions', []))}")
            print(f"   Results: {len(data.get('results', []))}")
        else:
            print(f"   ❌ Analysis failed: {data.get('error', 'Unknown error')}")
    else:
        print(f"   ❌ API error: {response.status_code}")
        print(f"   Response: {response.text[:500]}")
        
except requests.exceptions.Timeout:
    print(f"   ❌ Request timed out (60s)")
    print(f"   OpenAI API might be slow")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# ============================================================================
# TEST /api/graphs/generate ENDPOINT
# ============================================================================
print("\n6️⃣ TEST /api/graphs/generate ENDPOINT")
print("-" * 80)

try:
    payload = {
        'user_message': 'Show me sales by product category'
    }
    
    print(f"   Sending test query: {payload['user_message']}")
    response = requests.post(
        f"{flask_url}/api/graphs/generate",
        json=payload,
        timeout=60
    )
    
    print(f"   Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print(f"   ✅ Graph generation successful")
            charts = data.get('charts', [])
            print(f"   Charts generated: {len(charts)}")
            for i, chart in enumerate(charts[:3], 1):
                print(f"      Chart {i}: {chart.get('title', 'Untitled')}")
                print(f"         Type: {chart.get('chart_type', 'unknown')}")
                if 'data' in chart:
                    print(f"         Data points: {len(chart['data'])}")
                elif 'error' in chart:
                    print(f"         Error: {chart['error']}")
        else:
            print(f"   ❌ Generation failed: {data.get('error', 'Unknown error')}")
    else:
        print(f"   ❌ API error: {response.status_code}")
        print(f"   Response: {response.text[:500]}")
        
except requests.exceptions.Timeout:
    print(f"   ❌ Request timed out (60s)")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# ============================================================================
# DIRECT DATABASE QUERY TEST
# ============================================================================
print("\n7️⃣ DIRECT DATABASE QUERY TEST")
print("-" * 80)

try:
    with engine.connect() as conn:
        # Test simple select
        print("   Testing: SELECT * FROM \"Main\" LIMIT 5")
        result = conn.execute(text('SELECT * FROM "Main" LIMIT 5'))
        rows = result.fetchall()
        cols = result.keys()
        
        print(f"   ✅ Query successful")
        print(f"   Columns returned: {len(cols)}")
        print(f"   Rows returned: {len(rows)}")
        
        if len(rows) > 0:
            print(f"   First row (truncated):")
            for col, val in zip(cols, rows[0]):
                val_str = str(val)[:50] if val is not None else "NULL"
                print(f"      {col}: {val_str}")
        
except Exception as e:
    print(f"   ❌ Query failed: {str(e)}")

# ============================================================================
# SUMMARY & RECOMMENDATIONS
# ============================================================================
print("\n" + "="*80)
print("📋 SUMMARY & RECOMMENDATIONS")
print("="*80)

print("""
If you see ❌ errors above:

DATABASE ISSUES:
  - Check DB_URI in .env file
  - Verify database is running
  - Confirm 'Main' table exists
  - Check you have data in the table (SELECT COUNT(*) FROM "Main")

API ISSUES:
  - Is Flask running? (python backend_graphs_updated.py)
  - Check Flask logs for errors
  - Verify port 5000 is not in use

DATA ISSUES:
  - If /api/data shows empty array: database has no data
  - If /api/text/analyze fails: check OpenAI API key
  - If /api/graphs/generate fails: check SQL generation

FRONTEND ISSUES:
  - Check browser console (F12) for errors
  - Verify REACT_APP_API_URL is set correctly
  - Check network tab to see actual API responses
  - Make sure Flask and React are both running
""")

print("="*80 + "\n")
