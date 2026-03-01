const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

const configureGoogleStrategy = (passport) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CONFIG_MISSING');
  }

  passport.use(new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL: 'http://localhost:5000/api/auth/google/callback'
    },
    async (_accessToken, _refreshToken, profile, done) => {
      return done(null, profile);
    }
  ));
};

module.exports = configureGoogleStrategy;
