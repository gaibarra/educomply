module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-tailwindcss'
  ],
  plugins: [
    'stylelint-order'
  ],
  rules: {
    'at-rule-no-unknown': [true, {
      ignoreAtRules: [
        'tailwind', 'apply', 'layer', 'variants', 'responsive', 'screen'
      ]
    }],
    'order/properties-alphabetical-order': null
  },
  ignoreFiles: [
    'dist/**',
    'node_modules/**'
  ]
};
