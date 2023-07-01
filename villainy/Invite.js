module.exports = class Invite {
   constructor(client) {
      this.client = client;

      this.regex = {
         invite: /discord(?:\.com|app\.com|\.gg)(\/invite\/|\/)(?:[a-zA-Z0-9\-]+)/gim,
         url: /(discord.gg\/|discord.com\/invite\/|discordapp.com\/invite\/)/gim
      };

      this.cooldown = null;
      this.joinedBucket = 0;
      this.bucket = settings.invite.max;

      this.cache = [];
   }

   init() {
      if (!settings.invite.enabled) return;

      this.client.on('message', this.handleInvite.bind(this));
   }

   async handleInvite(msg) {
      if (!msg || !msg.content || this.cooldown && this.cooldown > new Date()) {
         return;
      }

      this.cooldown = null;

      const invites = msg.content.match(this.regex.invite);
      if (invites?.length + this.joinedBucket > this.bucket) {
         const index = (invites.length + this.joinedBucket) - this.bucket;
         invites.splice(0, index);
      }

      if (invites?.length) return this.handleCodes(msg,
         invites.map(i => i.replace(this.regex.url, '')).filter(i => !this.cache.includes(i))
      );
   }

   async handleCodes(msg, invites) {
      // Define vars
      const author = msg.author.tag;
      const account = this.client.user.tag;
      const origin = `Author: ${author} • Account: ${account}`;
      const location = msg.guild ? `${msg.guild.name} > #${msg.channel.name}` : 'DMs';
      const link = msg.url;

      invites = invites.filter(i => !this.cache.includes(i));

      for (const i of invites) {
         const { invite: { delay: { min, max }, queue } } = settings;

         const maximum = this.client.user.premiumType == 2 ? 200 : 100;
         if (this.client.guilds.cache.size >= maximum) {
            if (queue) {
               const account = active.find(client => {
                  if (client.user.id == this.client.user.id) return null;

                  const max = client.user.premiumType == 2 ? 200 : 100;
                  if (
                     client.guilds.cache.size >= max ||
                     client.main == true && settings.invite.onlyAlts
                  ) return null;

                  return client;
               });

               account?.invite?.handleInvite(msg, invites);
            }

            invites = [];
            break;
         }

         const waited = util.randomInt(min * 1000, max * 1000);
         const timeTook = `${(waited / 1000).toFixed(0)} second(s)`;
         await util.sleep(waited);
         if (this.cooldown && this.cooldown > new Date()) return;

         const invite = await this.client.user.getInvite(i).catch(() => null);

         if (!invite?.approximate_member_count) continue;

         this.cache.push(invite.code);
         if (
            invite.approximate_member_count <= settings.invite.members.min ||
            invite.approximate_member_count >= settings.invite.members.max
         ) continue;

         const joined = await this.client.user.acceptInvite(invite.code).catch((err) => ({
            message: err.message,
            error: true
         }));

         if (!joined) return;
         if (joined.error && joined.message) {
            if (webhook) webhook.fire('inviteFail', {
               invite: invite.code,
               server: invite.guild.name,
               error: joined.message,
               author: origin,
               location,
               timeTook,
               link
            });

            return logger.error(constants.inviteFail(
               invite.code,
               invite.guild.name,
               location,
               joined.message,
               author,
               account,
               timeTook
            ));
         }

         if (joined) {
            if (webhook) webhook.fire('inviteJoin', {
               invite: invite.code,
               server: invite.guild.name,
               author: origin,
               location,
               timeTook,
               link
            });

            logger.success(constants.joinedServer(
               invite.code,
               invite.guild.name,
               location,
               author,
               account,
               timeTook
            ));
            ++this.joinedBucket;
         }
      }

      if (this.joinedBucket >= this.bucket) {
         let date = new Date();
         date.setHours(date.getHours() + settings.invite.cooldown);
         this.cooldown = date;
         this.joinedBucket = 0;
         logger.warn(constants.cooldown('invite', settings.invite.max, settings.invite.cooldown));
      }
   }
};
