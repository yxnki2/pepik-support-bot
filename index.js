require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const waitingTickets = new Map();

function mainMenuEmbed() {
  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Vítejte v čekárně!')
    .setDescription('Zvolte prosím příslušnou kategorii, do které spadá Váš problém.');
}

function mainMenuRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('main_menu')
      .setPlaceholder('Vyberte kategorii')
      .addOptions([
        { label: 'Nahlášení hráče', value: 'report_player', emoji: '‼️' },
        { label: 'Nahlášení bugu', value: 'bug_report', emoji: '🐛' },
        { label: 'Žádost o zrušení trestu', value: 'appeal', emoji: '📄' },
        { label: 'Kontaktování vedení', value: 'management', emoji: '📘' },
        { label: 'Otázka - MC Server', value: 'mc_question', emoji: '🎮' }
      ])
  );
}

function backButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('back_main')
      .setLabel('Zpět')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  );
}

function finalButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('enough')
      .setLabel('Odpověď mi stačila')
      .setEmoji('🟩')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('need_help')
      .setLabel('Stále potřebuji pomoc')
      .setEmoji('🟥')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('back_main')
      .setLabel('Zpět')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  );
}

function staffButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_ticket')
      .setLabel('Claim')
      .setEmoji('🟨')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );
}

client.once('ready', () => {
  console.log(`✅ Bot je online jako ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: 'Čekárna • Support', type: 0 }],
    status: 'online'
  });
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channelId === process.env.WAITING_VOICE_ID) {
    const member = newState.member;
    const guild = newState.guild;

    const existingChannel = guild.channels.cache.find(
      c => c.name === `⏳・${member.user.username.toLowerCase()}`
    );

    if (existingChannel) return;

    const channel = await guild.channels.create({
      name: `⏳・${member.user.username}`,
      type: ChannelType.GuildText,
      parent: process.env.SUPPORT_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: member.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        ...[
          process.env.CEO_ROLE_ID,
          process.env.COOWNER_ROLE_ID,
          process.env.SENIORADMIN_ROLE_ID,
          process.env.TEAMLEAD_ROLE_ID,
          process.env.SUPPORT_ROLE_ID
        ].map(roleId => ({
          id: roleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }))
      ]
    });

    waitingTickets.set(channel.id, {
      userId: member.id,
      username: member.user.username,
      category: null,
      subcategory: null,
      claimedBy: null
    });

    await channel.send({
      content: `🎫 Vítej ${member}`,
      embeds: [mainMenuEmbed()],
      components: [mainMenuRow()]
    });
  }

  if (
    oldState.channelId === process.env.WAITING_VOICE_ID &&
    !newState.channelId
  ) {
    const member = oldState.member;
    const guild = oldState.guild;

    const channel = guild.channels.cache.find(
      c => c.name === `⏳・${member.user.username.toLowerCase()}`
    );

    if (channel) {
      await channel.send('❌ Ticket byl uzavřen, protože se uživatel odpojil z čekárny.');

      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 5000);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isStringSelectMenu()) {
    const ticket = waitingTickets.get(interaction.channel.id);

    if (interaction.customId === 'main_menu') {
      const value = interaction.values[0];

      if (value === 'report_player') {
        ticket.category = 'Nahlášení hráče';

        const embed = new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle('‼️ Nahlášení hráče')
          .setDescription('Zvolte prosím příslušnou podkategorii problému.');

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('report_player_menu')
            .setPlaceholder('Vyberte podkategorii')
            .addOptions([
              { label: 'Nepovolené modifikace', value: 'mods' },
              { label: 'Nevhodné chování v chatu', value: 'chat' },
              { label: 'Kažení hry', value: 'grief' },
              { label: 'Spam / reklama', value: 'spam' },
              { label: 'Vydávání se za tým', value: 'fake_staff' },
              { label: 'Jiné', value: 'other' }
            ])
        );

        return interaction.update({
          embeds: [embed],
          components: [row, backButton()]
        });
      }

      if (value === 'bug_report') {
        ticket.category = 'Nahlášení bugu';

        const embed = new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle('🐛 Nahlášení bugu')
          .setDescription('Zvolte prosím typ bugu, který chcete nahlásit.');

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('bug_report_menu')
            .setPlaceholder('Vyberte typ bugu')
            .addOptions([
              { label: 'Dupe glitch', value: 'dupe' },
              { label: 'Visual bug', value: 'visual' },
              { label: 'Server bug', value: 'server' },
              { label: 'Nefunkční příkaz', value: 'command' },
              { label: 'Problém s pluginem', value: 'plugin' },
              { label: 'Jiné', value: 'other' }
            ])
        );

        return interaction.update({
          embeds: [embed],
          components: [row, backButton()]
        });
      }
    }

    if (interaction.customId === 'report_player_menu') {
      const labels = {
        mods: 'Nepovolené modifikace',
        chat: 'Nevhodné chování v chatu',
        grief: 'Kažení hry',
        spam: 'Spam / reklama',
        fake_staff: 'Vydávání se za tým',
        other: 'Jiné'
      };

      ticket.subcategory = labels[interaction.values[0]];

      const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle(`Nahlášení hráče - ${ticket.subcategory}`)
        .setDescription(
          'Pokud máte k dispozici důkazní materiál k nahlášení hráče, dbejte prosím na to, aby:\n\n' +
          '• nebyl nijak upravený\n' +
          '• obsahoval datum a čas\n' +
          '• nebyl starší než 24 hodin\n\n' +
          'Důkazní materiál nahrajte přímo sem do ticketu jako screenshot/video, případně pošlete odkaz na YouTube, Streamable, Medal nebo Imgur.\n\n' +
          'Byla tato odpověď užitečná?'
        );

      return interaction.update({
        embeds: [embed],
        components: [finalButtons()]
      });
    }

    if (interaction.customId === 'bug_report_menu') {
      const labels = {
        dupe: 'Dupe glitch',
        visual: 'Visual bug',
        server: 'Server bug',
        command: 'Nefunkční příkaz',
        plugin: 'Problém s pluginem',
        other: 'Jiné'
      };

      ticket.subcategory = labels[interaction.values[0]];

      const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle(`Nahlášení bugu - ${ticket.subcategory}`)
        .setDescription(
          'Pokud nahlašujete bug, pokuste se prosím co nejpodrobněji popsat problém.\n\n' +
          'Doporučujeme přiložit:\n' +
          '• screenshot\n' +
          '• video\n' +
          '• postup, jak bug zopakovat\n\n' +
          'Důkazní materiál nahrajte přímo sem do ticketu jako screenshot/video, případně pošlete odkaz na YouTube, Streamable, Medal nebo Imgur.\n\n' +
          'Byla tato odpověď užitečná?'
        );

      return interaction.update({
        embeds: [embed],
        components: [finalButtons()]
      });
    }
  }

  if (interaction.isButton()) {
    const ticket = waitingTickets.get(interaction.channel.id);

    if (interaction.customId === 'back_main') {
      return interaction.update({
        embeds: [mainMenuEmbed()],
        components: [mainMenuRow()]
      });
    }

    if (interaction.customId === 'enough') {
      await interaction.update({
        content: '✅ Ticket byl označen jako vyřešený.',
        embeds: [],
        components: []
      });

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);

      return;
    }

    if (interaction.customId === 'need_help') {
      await interaction.channel.setName(`🟩・${ticket.username}`).catch(() => {});

      return interaction.update({
        content: `<@&${process.env.SUPPORT_ROLE_ID}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('📌 Ticket čeká na převzetí Support týmem')
            .setDescription(
              `Hráč: <@${ticket.userId}>\n` +
              `Kategorie: ${ticket.category}\n` +
              `Podkategorie: ${ticket.subcategory}\n` +
              `Status: Čeká na Support`
            )
        ],
        components: [staffButtons()]
      });
    }

    if (interaction.customId === 'claim_ticket') {
      ticket.claimedBy = interaction.user.id;

      await interaction.channel.setName(`🟨・${ticket.username}`).catch(() => {});

      return interaction.reply({
        content: `🟨 Ticket převzal ${interaction.user}.`,
        ephemeral: false
      });
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply('🔒 Ticket bude za 5 sekund uzavřen.');

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }
  }
});

client.login(process.env.TOKEN);