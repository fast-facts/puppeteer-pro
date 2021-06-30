module.exports = () => {
  try {
    const _query = window.navigator.permissions.query;
    const permissionsPrototype = Object.getPrototypeOf(window.navigator.permissions);
    permissionsPrototype.query = parameters => parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : _query(parameters);
    Object.setPrototypeOf(window.navigator.permissions, permissionsPrototype);
  } catch (ex) { null; }
};