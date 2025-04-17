export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  services: {
    product: process.env.PRODUCT_SERVICE_URL,
    cart: process.env.CART_SERVICE_URL,
  },
});
