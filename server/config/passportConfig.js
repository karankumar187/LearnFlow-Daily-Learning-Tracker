const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const setupPassport = () => {
    // Session Serialization
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

    // Google Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/auth/google/callback',
            proxy: true // Trust reverse proxies (like Render) to correctly parse HTTPS in callback URLs
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists
                let user = await User.findOne({ email: profile.emails[0].value });

                if (user) {
                    // If user exists but used a different provider, safely log them in
                    return done(null, user);
                }

                // If not, create a new user without a password
                user = await User.create({
                    name: profile.displayName || profile.emails[0].value.split('@')[0],
                    email: profile.emails[0].value,
                    authProvider: 'google',
                    providerId: profile.id,
                    avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : ''
                });

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
    }
};

module.exports = setupPassport;
