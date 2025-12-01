const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const { startKeepAlive } = require('./keep_alive');

// Start Keep Alive server first
startKeepAlive();

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;

   let pendingPromise = Promise.resolve();

   function sendRegister(password) {
      return new Promise((resolve, reject) => {
         bot.chat(`/register ${password} ${password}`);
         console.log(`[Auth] Sent /register command.`);

         let timeout = setTimeout(() => {
            console.log('[INFO] No response received for registration, assuming success.');
            resolve();
         }, 10000); // 10 second timeout

         let chatHandler = (username, message) => {
            // Ignore player messages, only listen to system messages
            if (username !== 'Server' && username !== '') {
               return; // Ignore player chat, wait for system message
            }

            clearTimeout(timeout);
            console.log(`[ChatLog] <${username}> ${message}`); // Log all chat messages

            // Check for various possible responses
            if (message.includes('successfully registered')) {
               console.log('[INFO] Registration confirmed.');
               bot.removeListener('chat', chatHandler);
               resolve();
            } else if (message.includes('already registered')) {
               console.log('[INFO] Bot was already registered.');
               bot.removeListener('chat', chatHandler);
               resolve(); // Resolve if already registered
            } else if (message.includes('Invalid command')) {
               bot.removeListener('chat', chatHandler);
               reject(`Registration failed: Invalid command. Message: "${message}"`);
            }
         };

         bot.on('chat', chatHandler);
      });
   }

   function sendLogin(password) {
      return new Promise((resolve, reject) => {
         bot.chat(`/login ${password}`);
         console.log(`[Auth] Sent /login command.`);

         let timeout = setTimeout(() => {
            console.log('[INFO] No response received for login, assuming success.');
            resolve();
         }, 10000); // 10 second timeout

         let chatHandler = (username, message) => {
            // Ignore player messages, only listen to system messages
            if (username !== 'Server' && username !== '') {
               return; // Ignore player chat, wait for system message
            }

            clearTimeout(timeout);
            console.log(`[ChatLog] <${username}> ${message}`); // Log all chat messages

            if (message.includes('successfully logged in')) {
               console.log('[INFO] Login successful.');
               bot.removeListener('chat', chatHandler);
               resolve();
            } else if (message.includes('Invalid password')) {
               bot.removeListener('chat', chatHandler);
               reject(`Login failed: Invalid password. Message: "${message}"`);
            } else if (message.includes('not registered')) {
               bot.removeListener('chat', chatHandler);
               reject(`Login failed: Not registered. Message: "${message}"`);
            }
         };

         bot.on('chat', chatHandler);
      });
   }

   bot.once('spawn', () => {
      console.log('\x1b[33m[AfkBot] Bot joined the server', '\x1b[0m');

      if (config.utils['auto-auth'].enabled) {
         console.log('[INFO] Started auto-auth module');

         const password = config.utils['auto-auth'].password;

         pendingPromise = pendingPromise
            .then(() => sendRegister(password))
            .then(() => sendLogin(password))
            .catch(error => console.error('[ERROR]', error));
      }

      if (config.utils['chat-messages'].enabled) {
         console.log('[INFO] Started chat-messages module');
         const messages = config.utils['chat-messages']['messages'];

         if (config.utils['chat-messages'].repeat) {
            const delay = config.utils['chat-messages']['repeat-delay'];
            let i = 0;

            let msg_timer = setInterval(() => {
               bot.chat(`${messages[i]}`);

               if (i + 1 === messages.length) {
                  i = 0;
               } else {
                  i++;
               }
            }, delay * 1000);
         } else {
            messages.forEach((msg) => {
               bot.chat(msg);
            });
         }
      }

      const pos = config.position;

      if (config.position.enabled) {
         console.log(
            `\x1b[32m[Afk Bot] Starting to move to target location (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`
         );
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      if (config.utils['anti-afk'].enabled) {
         bot.setControlState('jump', true);
         if (config.utils['anti-afk'].sneak) {
            bot.setControlState('sneak', true);
         }
      }
   });

   bot.on('goal_reached', () => {
      console.log(
         `\x1b[32m[AfkBot] Bot arrived at the target location. ${bot.entity.position}\x1b[0m`
      );
   });

   bot.on('death', () => {
      console.log(
         `\x1b[33m[AfkBot] Bot has died and was respawned at ${bot.entity.position}`,
         '\x1b[0m'
      );
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         setTimeout(() => {
            createBot();
         }, config.utils['auto-reconnect-delay']);
      });
   }

   bot.on('kicked', (reason) =>
      console.log(
         '\x1b[33m',
         `[AfkBot] Bot was kicked from the server. Reason: \n${reason}`,
         '\x1b[0m'
      )
   );

   bot.on('error', (err) =>
      console.log(`\x1b[31m[ERROR] ${err.message}`, '\x1b[0m')
   );
}

createBot();
