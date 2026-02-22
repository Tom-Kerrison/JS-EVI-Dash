#!/usr/bin/env python3
"""
Database inspection script
Shows all tables and their columns
"""

import os
from sqlalchemy import create_engine, inspect, text
from dotenv import load_dotenv

load_dotenv()

DB_URI = os.getenv('DB_URI')

if not DB_URI:
    print("❌ DB_URI not found in .env file")
    exit(1)

print(f"Database URI: {DB_URI}")
print("="*60)

try:
    engine = create_engine(DB_URI)
    
    # Get inspector
    inspector = inspect(engine)
    
    # List all tables
    tables = inspector.get_table_names()
    print(f"\n📋 Tables in database ({len(tables)} total):")
    print("-"*60)
    
    for table_name in tables:
        columns = inspector.get_columns(table_name)
        print(f"\n📊 Table: {table_name}")
        print(f"   Columns: {len(columns)}")
        for col in columns[:10]:  # Show first 10 columns
            col_type = str(col['type'])
            nullable = "NULL" if col['nullable'] else "NOT NULL"
            print(f"     - {col['name']:<30} {col_type:<20} {nullable}")
        if len(columns) > 10:
            print(f"     ... and {len(columns) - 10} more columns")
    
    # Try to get row count for each table
    print("\n" + "="*60)
    print("📈 Row counts:")
    print("-"*60)
    for table_name in tables:
        try:
            with engine.connect() as conn:
                result = conn.execute(text(f"SELECT COUNT(*) as count FROM {table_name}"))
                count = result.scalar()
                print(f"{table_name:<30} {count:>10} rows")
        except Exception as e:
            print(f"{table_name:<30} Error: {str(e)[:50]}")
    
    print("\n" + "="*60)
    print("✅ Database inspection complete!")
    
except Exception as e:
    print(f"❌ Error connecting to database: {e}")
    exit(1)
