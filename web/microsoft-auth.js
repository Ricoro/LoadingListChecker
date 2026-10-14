const { PublicClientApplication } = require('@azure/msal-browser');
const scopes = ['https://graph.microsoft.com/Sites.Selected'];
class MicrosoftAuth {
  constructor(config) {
    this.client = new PublicClientApplication({ auth:{ clientId:config.clientId, authority:`https://login.microsoftonline.com/${config.tenantId}`, redirectUri:new URL('auth.html',location.href).href }, cache:{cacheLocation:'sessionStorage'} });
    this.ready = this.client.initialize();
  }
  async restore() {
    await this.ready;
    const account = this.client.getActiveAccount() || this.client.getAllAccounts()[0];
    if (account) this.client.setActiveAccount(account);
    return account;
  }
  async signIn() {
    await this.ready;
    const result = await this.client.loginPopup({scopes,prompt:'select_account'});
    this.client.setActiveAccount(result.account); return result.account;
  }
  async token() {
    await this.ready;
    const account = this.client.getActiveAccount();
    if (!account) throw new Error('Sign in with your work account to save or open shared comparisons.');
    try { return (await this.client.acquireTokenSilent({scopes,account})).accessToken; }
    catch { throw new Error('Please sign in again to access shared comparisons.'); }
  }
  async signOut() { await this.ready; await this.client.clearCache(); this.client.setActiveAccount(null); }
}
module.exports = { MicrosoftAuth };
