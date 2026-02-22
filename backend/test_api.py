#!/usr/bin/env python3
"""
Test script to verify ExorVia backend endpoints
Run this to debug API issues
"""

import requests
import json
from pprint import pprint

API_BASE_URL = "http://localhost:5000/api"

def test_health():
    """Test health endpoint"""
    print("\n" + "="*60)
    print("TEST 1: Health Check")
    print("="*60)
    try:
        response = requests.get(f"{API_BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response:")
        pprint(response.json())
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_data():
    """Test data endpoint"""
    print("\n" + "="*60)
    print("TEST 2: Dashboard Data (/api/data)")
    print("="*60)
    try:
        response = requests.get(f"{API_BASE_URL}/data")
        print(f"Status: {response.status_code}")
        
        data = response.json()
        print(f"Response type: {type(data)}")
        
        if isinstance(data, list):
            print(f"✅ Response is array with {len(data)} records")
            if len(data) > 0:
                print(f"First record sample:")
                pprint(data[0])
            return True
        elif isinstance(data, dict):
            print(f"Response is object with keys: {list(data.keys())}")
            if 'data' in data:
                print(f"  - 'data' field has {len(data['data'])} records")
                if len(data['data']) > 0:
                    print(f"    First record:")
                    pprint(data['data'][0])
            pprint(data)
            return False
        else:
            print(f"❌ Unexpected response type: {type(data)}")
            pprint(data)
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_text_analysis():
    """Test text analysis endpoint"""
    print("\n" + "="*60)
    print("TEST 3: Text Analysis (/api/text/analyze)")
    print("="*60)
    try:
        payload = {"user_message": "What are the top 5 product categories by revenue?"}
        response = requests.post(f"{API_BASE_URL}/text/analyze", json=payload)
        print(f"Status: {response.status_code}")
        data = response.json()
        
        if data.get('success'):
            print("✅ Success")
            print(f"Summary: {data.get('summary', 'N/A')[:100]}...")
            print(f"Questions generated: {len(data.get('questions', []))}")
            print(f"Results: {len(data.get('results', []))}")
            return True
        else:
            print(f"❌ Error: {data.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    print("\n" + "🚀 ExorVia API Test Suite".center(60))
    print("="*60)
    print(f"API Base URL: {API_BASE_URL}")
    print("="*60)
    
    results = {
        'health': test_health(),
        'data': test_data(),
        'text_analysis': test_text_analysis(),
    }
    
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.ljust(20)}: {status}")
    
    print("="*60)
    
    if all(results.values()):
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed. Check the output above.")


if __name__ == "__main__":
    main()
