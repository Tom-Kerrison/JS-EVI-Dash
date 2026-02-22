// Add this to your React component to debug API calls

const DEBUG_API = {
  // Test dashboard data
  testDashboardData: async () => {
    console.log('🧪 Testing /api/data...');
    try {
      const response = await fetch('http://localhost:5000/api/data');
      console.log('   Status:', response.status);
      console.log('   Headers:', {
        'Content-Type': response.headers.get('content-type'),
        'Content-Length': response.headers.get('content-length')
      });
      
      const data = await response.json();
      console.log('   ✅ Data received');
      console.log('   Records:', Array.isArray(data) ? data.length : 'NOT AN ARRAY');
      if (Array.isArray(data) && data.length > 0) {
        console.log('   First record:', data[0]);
      }
      return data;
    } catch (e) {
      console.error('   ❌ Error:', e.message);
      return null;
    }
  },

  // Test text analysis
  testTextAnalysis: async () => {
    console.log('🧪 Testing /api/text/analyze...');
    try {
      const response = await fetch('http://localhost:5000/api/text/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_message: 'What are total sales?' })
      });
      console.log('   Status:', response.status);
      
      const data = await response.json();
      console.log('   ✅ Response received');
      console.log('   Success:', data.success);
      console.log('   Summary:', data.summary?.substring(0, 100) + '...');
      console.log('   Questions:', data.questions?.length);
      return data;
    } catch (e) {
      console.error('   ❌ Error:', e.message);
      return null;
    }
  },

  // Test graph generation
  testGraphGeneration: async () => {
    console.log('🧪 Testing /api/graphs/generate...');
    try {
      const response = await fetch('http://localhost:5000/api/graphs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_message: 'Show me sales by category' })
      });
      console.log('   Status:', response.status);
      
      const data = await response.json();
      console.log('   ✅ Response received');
      console.log('   Success:', data.success);
      console.log('   Charts:', data.charts?.length);
      if (data.charts?.length > 0) {
        console.log('   First chart:', {
          title: data.charts[0].title,
          type: data.charts[0].chart_type,
          dataPoints: data.charts[0].data?.length
        });
      }
      return data;
    } catch (e) {
      console.error('   ❌ Error:', e.message);
      return null;
    }
  },

  // Test health
  testHealth: async () => {
    console.log('🧪 Testing /api/health...');
    try {
      const response = await fetch('http://localhost:5000/api/health');
      console.log('   Status:', response.status);
      
      const data = await response.json();
      console.log('   ✅ API is running');
      console.log('   Database:', data.database);
      console.log('   Environment:', data.environment);
      return data;
    } catch (e) {
      console.error('   ❌ Cannot reach API');
      console.error('   Make sure Flask is running on port 5000');
      return null;
    }
  },

  // Run all tests
  runAllTests: async () => {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 RUNNING ALL API TESTS');
    console.log('='.repeat(60) + '\n');
    
    await DEBUG_API.testHealth();
    console.log('');
    
    await DEBUG_API.testDashboardData();
    console.log('');
    
    await DEBUG_API.testTextAnalysis();
    console.log('');
    
    await DEBUG_API.testGraphGeneration();
    console.log('');
    
    console.log('='.repeat(60));
    console.log('✅ Tests complete! Check results above');
    console.log('='.repeat(60));
  }
};

// Use in console:
// DEBUG_API.runAllTests()
// or individual tests:
// DEBUG_API.testDashboardData()
// DEBUG_API.testTextAnalysis()
// DEBUG_API.testGraphGeneration()

export default DEBUG_API;
