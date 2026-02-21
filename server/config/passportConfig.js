const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
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
            callbackURL: '/api/auth/google/callback'
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

    // GitHub Strategy
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
        passport.use(new GitHubStrategy({
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: '/api/auth/github/callback',
            scope: ['user:email']
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `${profile.username}@github.com`;

                let user = await User.findOne({ email });

                if (user) {
                    return done(null, user);
                }

                user = await User.create({
                    name: profile.displayName || profile.username,
                    email: email,
                    authProvider: 'github',
                    providerId: profile.id,
                    avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : ''
                });

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
    }

    // Apple Strategy
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID) {
        passport.use(new AppleStrategy({
            clientID: process.env.APPLE_CLIENT_ID,
            teamID: process.env.APPLE_TEAM_ID,
            keyID: process.env.APPLE_KEY_ID,
            privateKeyString: process.env.APPLE_PRIVATE_KEY,
            callbackURL: '/api/auth/apple/callback'
        }, async (accessToken, refreshToken, idToken, profile, done) => {
            try {
                const email = idToken.email; // Apple usually provides this in the token
                if (!email) {
                    return done(new Error('Apple auth failed to provide email'), null);
                }

                let user = await User.findOne({ email });

                if (user) {
                    return done(null, user);
                }

                user = await User.create({
                    name: email.split('@')[0], // Apple minimizes data, sometimes name isn't reliably parsed
                    email: email,
                    authProvider: 'apple',
                    providerId: idToken.sub,
                    avatar: ''
                });

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
    }
};

module.exports = setupPassport;
