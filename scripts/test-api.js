/**
 * API Test Script
 * Tests all major API endpoints to verify system functionality
 * 
 * Usage: node test-api.js
 */

const http = require('http');

const ADMIN_API = 'http://localhost:3002';
const USER_API = 'http://localhost:3001';

let adminToken = null;
let userToken = null;

// Helper function to make HTTP requests
function request(url, method = 'GET', body = null, token = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// Test functions
async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        return true;
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('🧪 Certificate Distribution System - API Tests\n');
    console.log('================================================\n');
    
    let passed = 0;
    let failed = 0;

    // Health checks
    console.log('📡 Health Checks:');
    if (await test('Admin API Health', async () => {
        const res = await request(`${ADMIN_API}/health`);
        if (res.status !== 200) throw new Error('Not responding');
    })) passed++; else failed++;

    if (await test('User API Health', async () => {
        const res = await request(`${USER_API}/health`);
        if (res.status !== 200) throw new Error('Not responding');
    })) passed++; else failed++;

    console.log('\n🔐 Authentication:');
    
    // Admin login
    if (await test('Admin Login', async () => {
        const res = await request(`${ADMIN_API}/api/auth/login`, 'POST', {
            email: 'admin@test.com',
            password: 'admin123'
        });
        if (!res.data.success) throw new Error(res.data.message);
        adminToken = res.data.data.accessToken;
    })) passed++; else failed++;

    // User login
    if (await test('User Login', async () => {
        const res = await request(`${USER_API}/api/auth/login`, 'POST', {
            email: 'aarav.sharma1@test.com',
            password: 'user123'
        });
        if (!res.data.success) throw new Error(res.data.message);
        userToken = res.data.data.accessToken;
    })) passed++; else failed++;

    console.log('\n📋 Admin API - Competitions:');
    
    if (await test('List Competitions', async () => {
        const res = await request(`${ADMIN_API}/api/competitions`, 'GET', null, adminToken);
        if (!res.data.success) throw new Error(res.data.message);
    })) passed++; else failed++;

    if (await test('Get Cities', async () => {
        const res = await request(`${ADMIN_API}/api/competitions/cities`, 'GET', null, adminToken);
        if (!res.data.success) throw new Error(res.data.message);
    })) passed++; else failed++;

    console.log('\n👥 Admin API - Users:');
    
    if (await test('List Users', async () => {
        const res = await request(`${ADMIN_API}/api/users`, 'GET', null, adminToken);
        if (!res.data.success) throw new Error(res.data.message);
    })) passed++; else failed++;

    console.log('\n📜 Admin API - Certificates:');
    
    if (await test('List Templates', async () => {
        const res = await request(`${ADMIN_API}/api/certificates/templates`, 'GET', null, adminToken);
        if (!res.data.success) throw new Error(res.data.message);
    })) passed++; else failed++;

    console.log('\n🏆 User API - Features:');
    
    if (await test('Get User Profile', async () => {
        const res = await request(`${USER_API}/api/profile`, 'GET', null, userToken);
        if (!res.data.success) throw new Error(res.data.message);
    })) passed++; else failed++;

    if (await test('List User Competitions', async () => {
        const res = await request(`${USER_API}/api/competitions`, 'GET', null, userToken);
        if (!res.data.success) throw new Error(res.data.message);
    })) passed++; else failed++;

    if (await test('Get Leaderboard', async () => {
        const res = await request(`${USER_API}/api/leaderboard`, 'GET', null, userToken);
        if (!res.data.success) throw new Error(res.data.message);
    })) passed++; else failed++;

    if (await test('Get User Certificates', async () => {
        const res = await request(`${USER_API}/api/certificates`, 'GET', null, userToken);
        if (!res.data.success) throw new Error(res.data.message);
    })) passed++; else failed++;

    console.log('\n================================================');
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! System is working correctly.\n');
    } else {
        console.log('\n⚠️  Some tests failed. Check the services above.\n');
    }
}

runTests().catch(console.error);
