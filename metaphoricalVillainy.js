const { Util: { mergeDefault } } = require('discord.js');
const JSON5 = require('json5');

async function init() {
   // some needs you feel me
   const Constants = require('./madlib/Constants');
   const Dashboard = require('./madlib/Dashboard');
   const Webhook = require('./madlib/Webhook');
   const Logger = require('./madlib/Logger');
   const modes = require('./modes/index');
   const Util = require('./madlib/Util');
   const chalk = require('chalk');
   const phin = require('phin');

   // calls dotenv to recognize env vars
   require('dotenv').config({
      multiline: 'line-breaks',
      path: 'settings.env'
   });

   console.log(chalk.green(`
         88                                             
         88                                             
         88                                             
 ,adPPYb,88  ,adPPYba,   ,adPPYba,  88,dPYba,,adPYba,   
a8"    `Y88 a8"     "8a a8"     "8a 88P'   "88"    "8a  
8b       88 8b       d8 8b       d8 88      88      88  
"8a,   ,d88 "8a,   ,a8" "8a,   ,a8" 88      88      88  
 `"8bbdP"Y8  `"YbbdP"'   `"YbbdP"'  88      88      88  
   `));

   // Define globals
   global.active = [];
   global.webhook = null;
   global.constants = Constants;
   global.util = Util;
   global.logger = new Logger({ debug: false });
   global.dashboard = new Dashboard();
   global.paymentSourceId = null;

   // Try to parse settings
   try {
      global.settings = JSON5.parse(process.env.settings);
   } catch {
      return logger.critical(constants.invalidConfig);
   }

   // Define settings with defaults
   global.settings = mergeDefault(constants.defaultSettings, settings);

   if (!settings.mode) return logger.critical(constants.noMode);
   if (!Object.keys(modes).includes(settings.mode)) return logger.critical(constants.invalidMode);

   // Init selected mode
   await modes[settings.mode]();

   if (!active.length) return logger.critical(constants.invalidTokens);

   // Counters
   const guildCount = active
      .map((s) => s.guilds.cache.size)
      .reduce((a, b) => a + b, 0);

   // Get payment method
   const res = await phin({
      url: constants.paymentSourceURL,
      method: 'GET',
      parse: 'json',
      headers: {
         'Authorization': settings.tokens.main,
         'User-Agent': constants.userAgent
      }
   });

   if (!res.body?.length) {
      logger.warn(constants.noPaymentMethod);
   } else if (res.body[0]) {
      const method = res.body.find?.(p => p.default)?.id;
      global.paymentSourceId = method;
   } else {
      logger.warn(constants.paymentMethodFail(res.body));
   }

   // Init webhook
   if (settings.webhook?.url) {
      const webhookToken = /[^/]*$/.exec(settings.webhook.url)[0];
      const webhookId = settings.webhook.url.replace(/^.*\/(?=[^\/]*\/[^\/]*$)|\/[^\/]*$/g, '');
      global.webhook = new Webhook(webhookId, webhookToken);
   }

   return logger.success(constants.ready(active.length, guildCount));
}

init();
