const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }

  const normalizedRequiredRoles = roles.map((role) => String(role || '').toUpperCase());
  const normalizedUserRole = String(req.user.role || '').toUpperCase();
  const effectiveUserRole = normalizedUserRole === 'USER' ? 'CUSTOMER' : normalizedUserRole;

  if (!normalizedRequiredRoles.includes(effectiveUserRole)) {
    return res.status(403).json({ message: 'Forbidden access' });
  }

  return next();
};

module.exports = authorize;
