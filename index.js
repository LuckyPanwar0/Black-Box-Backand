const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test Route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Payment Backend is running!' });
});

// In-memory OTP Cache (For production, use Redis or a Database)
const otpStore = new Map();

// Generate Random OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Route: Send OTP
app.post('/api/otp/send', (req, res) => {
    const { mobile } = req.body;
    if (!mobile || mobile.length < 10) {
        return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }

    const otp = generateOTP();
    otpStore.set(mobile, { otp, expires: Date.now() + 5 * 60 * 1000 }); // 5 min expiry

    // SIMULATED SMS SENDING
    console.log(`\n---------------------------------`);
    console.log(`[AUTH] Sending OTP ${otp} to +91${mobile}`);
    console.log(`---------------------------------\n`);

    res.json({ success: true, message: 'OTP sent successfully (Check server console)' });
});

// Route: Verify OTP
app.post('/api/otp/verify', (req, res) => {
    const { mobile, otp } = req.body;
    const stored = otpStore.get(mobile);

    if (!stored) {
        return res.status(400).json({ success: false, message: 'OTP not requested or expired' });
    }

    if (stored.expires < Date.now()) {
        otpStore.delete(mobile);
        return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    if (stored.otp === otp) {
        otpStore.delete(mobile); // Clear after use
        res.json({ 
            success: true, 
            message: 'Login successful',
            user: {
                mobile,
                token: 'mock-jwt-token-' + Date.now(),
                name: 'User ' + mobile.slice(-4)
            }
        });
    } else {
        res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
});

// Create Order Route
app.post('/api/create-order', async (req, res) => {
    try {
        const { amount, order_id, customer_mobile, remark2, env } = req.body;
        
        // Use environment variables for sensitive data
        const userToken = process.env.IMB_USER_TOKEN;
        const redirectUrl = process.env.REDIRECT_URL || 'https://blackbuck-demo.vercel.app';

        // Priority to PAYMENT_GATEWAY_URL from .env if present
        const apiUrl = process.env.PAYMENT_GATEWAY_URL || (env === 'production' 
            ? 'https://secure.imbpayment.in/api/create-order'
            : 'https://secure-stage.imb.org.in/api/create-order');

        const payload = new URLSearchParams();
        payload.append('user_token', userToken);
        payload.append('amount', amount);
        payload.append('order_id', order_id);
        payload.append('customer_mobile', customer_mobile || '9876543210');
        payload.append('redirect_url', `${redirectUrl}/?status=success&order=${order_id}`);
        payload.append('remark1', 'system@blackbuck');
        payload.append('remark2', remark2 || 'Payment');

        console.log(`Calling IMB API: ${apiUrl}`);

        const response = await axios.post(apiUrl, payload.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Payment Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to communicate with payment gateway',
            error: error.message 
        });
    }
});

// For local testing
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
