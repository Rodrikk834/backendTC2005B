function validateBody(fields = []) {
  return (req, res, next) => {
    const missingFields = fields.filter(field => !req.body || req.body[field] === undefined || req.body[field] === null || req.body[field] === '');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Faltan campos obligatorios: ${missingFields.join(', ')}`
      });
    }

    next();
  };
}

module.exports = {
  validateBody
};
