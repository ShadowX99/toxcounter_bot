var moment = Moment.load();

/**
 * Handle GET request to application
 * @returns {*}
 */
function doGet() {
  return ContentService.createTextOutput('Method not allowed.');
}

/**
 * Handle POST request to application
 * @param e
 */
function doPost(e) {
  if (e.postData.type === "application/json") {
    const chatRepository = new ChatRepository(config.chatDataSsid);
    const userRepository = new UserRepository(config.userDataSsid);
    const payload = JSON.parse(e.postData.contents);
    const client = new TelegramClient(config.url, config.token, payload);
    const bus = new CmdBus();
    const userMiddleware = new UserMiddleware(client, userRepository);

    userMiddleware.handle();

    bus.on(/\/start/, function () {
      const chatId = this.payload.message.chat.id;
      var chatDto = chatRepository.find({chatId: chatId});
      if (!chatDto.chatId) {
        chatDto.chatId = chatId;
        chatDto.updatedAt = moment().format(config.dateTimeFormat);

        chatRepository.create(chatDto);

        this.sendMessageChat(messages.active);
      } else {
        this.sendMessageChat(messages.alreadyActive);
      }
    });

    bus.on(/\/flush/, function () {
      const chatId = this.payload.message.chat.id;
      var chatDto = chatRepository.find({chatId: chatId});
      if (chatDto.chatId) {
        var timestamp = moment(chatDto.updatedAt).zone('+0600').format(config.dateTimeFormat);
        var days = moment().diff(moment(timestamp, config.dateTimeFormat), 'days');
        var minutes = moment().diff(moment(timestamp, config.dateTimeFormat), 'minutes');

        chatDto.updatedAt = moment(new Date()).format(config.dateTimeFormat);
        if (days > chatDto.maxDays) {
          chatDto.maxDays = days;
        }

        if (minutes > chatDto.maxMinutes) {
          chatDto.maxMinutes = minutes;
        }

        chatRepository.edit(chatDto);

        this.sendStickerChat(config.stickerId);
      } else {
        this.sendMessageChat(messages.notActive);
      }
    });

    bus.on(/\/stat/, function () {
      const chatId = this.payload.message.chat.id;
      var chatDto = chatRepository.find({chatId: chatId});
      if (chatDto.chatId) {
        var timestamp = moment(chatDto.updatedAt).zone('+0600').format(config.dateTimeFormat);
        var days = moment().diff(moment(timestamp, config.dateTimeFormat), 'days');
        var minutes = moment().diff(moment(timestamp, config.dateTimeFormat), 'minutes');
        var date = moment(timestamp, config.dateTimeFormat).format(config.dateFormat);

        this.sendMessageChat(messages.stat.format(days, minutes, chatDto.maxDays || days, chatDto.maxMinutes || minutes, date));
      } else {
        this.sendMessageChat(messages.notActive);
      }
    });

    bus.on(/\/tox(\S+)? ?(\S+)?/, function (bot, mention) {
      const userFrom = this.payload.message.from;
      const botInfo = this.getMe();

      const chatId = this.payload.message.chat.id;
      var userDto = mention !== undefined ?
        userRepository.find({username: mention.replace('@', '')}) :
        userRepository.getRandom(chatId);

      if (userDto.username === botInfo.result.username) {
        userDto = userRepository.find({username: userFrom.username});
      }

      if (userDto.row === null) {
        this.sendMessageChat(messages.userNotActive, userFrom.username);
        return;
      }

      const response = this.getChatMember(chatId, userDto.userId);

      if (response === null) {
        this.sendMessageChat(messages.userNotFound, userFrom.username);
        return;
      }

      const toxService = new ToxService(
        messages.tox.appeals,
        messages.tox.bodies,
        messages.tox.swearWords,
        messages.tox.conclusions
      );

      this.sendMessageChat(toxService.get(userDto.username), userDto.username);
    });

    bus.on(/\/help/, function () {
      this.sendMessageChat(messages.help);
    });

    client.register(bus);

    if (payload) {
      client.process();
    }
  }
}

/**
 * Manual actions to control webhook
 */
function getWebhookInfo() {
  const client = new TelegramClient(config.url, config.token, {});
  const response = client.getWebhookInfo();
  Logger.log(response);
}

function deleteWebhook() {
  const client = new TelegramClient(config.url, config.token, {});
  const response = client.deleteWebhook();
  Logger.log(response);
}

function setWebhook() {
  const client = new TelegramClient(config.url, config.token, {});
  const gUrl = ScriptApp.getService().getUrl();
  const response = client.setWebhook(gUrl);
  Logger.log(response);
}

function getUpdates() {
  const client = new TelegramClient(config.url, config.token, {});
  const response = client.getUpdates();
  Logger.log(response);
}