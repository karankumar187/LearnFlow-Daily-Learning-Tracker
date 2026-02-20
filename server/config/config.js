module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
  TIMEZONE: 'Asia/Kolkata'
};
