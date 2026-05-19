require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
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
        { label: 'Otázka - MC Server', value: 'mc_question', emoji: '🎮' },
        { label: 'Otázka - Discord', value: 'discord_question', emoji: '💬' }
      ])
  );
}

function backButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('back_main')
      .setLabel('Zpět')
      .setStyle(ButtonStyle.Secondary)
  );
}

function finalButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('enough')
      .setLabel('Odpověď mi stačila')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('need_help')
      .setLabel('Stále potřebuji pomoc')
      .setStyle(ButtonStyle.Danger)
  );
}

function staffButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_ticket')
      .setLabel('Převzít ticket')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Uzavřít')
      .setStyle(ButtonStyle.Danger)
  );
}

client.once('ready', () => {
  console.log(`✅ Bot je online jako ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: 'Čekárna • Support', type: 0 }],
    status: 'online'
  });
});client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channelId === process.env.WAITING_VOICE_ID) {
    const member = newState.member;
    const guild = newState.guild;
    const username = member.user.username.toLowerCase();

    const existingChannel = guild.channels.cache.find(
      c =>
        c.name === `⏳・${username}` ||
        c.name === `🟩・${username}` ||
        c.name === `🟦・${username}` ||
        c.name === `🟥・${username}` ||
        c.name === `🟧・${username}` ||
        c.name === `🟨・${username}`
    );

    if (existingChannel) return;

    const channel = await guild.channels.create({
      name: `⏳・${username}`,
      type: ChannelType.GuildText,
      parent: process.env.SUPPORT_CATEGORY_ID,

      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: member.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        ...[
          process.env.SUPPORT_ROLE_ID,
          process.env.SENIORADMIN_ROLE_ID,
          process.env.TEAMLEAD_ROLE_ID,
          process.env.CEO_ROLE_ID
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
      username,
      category: null,
      subcategory: null,
      claimedBy: null
    });

    await channel.send({
      content: `<@${member.id}>`,
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
    const username = member.user.username.toLowerCase();

    const channel = guild.channels.cache.find(
      c =>
        c.name === `⏳・${username}` ||
        c.name === `🟩・${username}` ||
        c.name === `🟦・${username}` ||
        c.name === `🟥・${username}` ||
        c.name === `🟧・${username}` ||
        c.name === `🟨・${username}`
    );

    if (channel) {
      await channel.send('❌ Ticket byl uzavřen, protože se uživatel odpojil z čekárny.');

      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 5000);
    }
  }
});

function getRouting(ticket) {
  const category = ticket.category;

  if (category === 'Nahlášení hráče') {
    return {
      emoji: '🟩',
      roles: `<@&${process.env.SUPPORT_ROLE_ID}>\n<@&${process.env.SENIORADMIN_ROLE_ID}>\n<@&${process.env.CEO_ROLE_ID}>`
    };
  }

  if (category === 'Nahlášení bugu') {
    return {
      emoji: '🟦',
      roles: `<@&${process.env.TEAMLEAD_ROLE_ID}>\n<@&${process.env.CEO_ROLE_ID}>`
    };
  }

  if (category === 'Žádost o zrušení trestu') {
    return {
      emoji: '🟥',
      roles: `<@&${process.env.SENIORADMIN_ROLE_ID}>\n<@&${process.env.CEO_ROLE_ID}>`
    };
  }

  if (category === 'Kontaktování vedení') {
    return {
      emoji: '🟧',
      roles: `<@&${process.env.CEO_ROLE_ID}>`
    };
  }

  if (category === 'Otázka - MC Server') {
    return {
      emoji: '🟦',
      roles: `<@&${process.env.TEAMLEAD_ROLE_ID}>\n<@&${process.env.CEO_ROLE_ID}>`
    };
  }

  if (category === 'Otázka - Discord') {
    return {
      emoji: '🟥',
      roles: `<@&${process.env.SENIORADMIN_ROLE_ID}>\n<@&${process.env.CEO_ROLE_ID}>`
    };
  }

  return {
    emoji: '🟩',
    roles: `<@&${process.env.SUPPORT_ROLE_ID}>`
  };
}client.on('interactionCreate', async interaction => {
  if (interaction.isStringSelectMenu()) {
    const ticket = waitingTickets.get(interaction.channel.id);

    if (!ticket) {
      return interaction.reply({
        content: '❌ Tento ticket už není aktivní.',
        ephemeral: true
      });
    }

    if (interaction.customId === 'main_menu') {
      const value = interaction.values[0];

      if (value === 'report_player') {
        ticket.category = 'Nahlášení hráče';

        const embed = new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle('‼️ Nahlášení hráče')
          .setDescription('Vyberte prosím typ nahlášení.');

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('report_player_menu')
            .setPlaceholder('Vyberte kategorii')
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
          .setDescription('Vyberte prosím typ bugu.');

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('bug_report_menu')
            .setPlaceholder('Vyberte kategorii')
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

      if (value === 'appeal') {
        ticket.category = 'Žádost o zrušení trestu';

        const embed = new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle('📄 Žádost o zrušení trestu')
          .setDescription('Vyberte prosím typ trestu.');

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('appeal_menu')
            .setPlaceholder('Vyberte kategorii')
            .addOptions([
              { label: 'Mute', value: 'mute' },
              { label: 'Ban', value: 'ban' },
              { label: 'IP Ban', value: 'ipban' },
              { label: 'Stížnost', value: 'complaint' },
              { label: 'Jiné', value: 'other' }
            ])
        );

        return interaction.update({
          embeds: [embed],
          components: [row, backButton()]
        });
      }

      if (value === 'management') {
        ticket.category = 'Kontaktování vedení';

        const embed = new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle('📘 Kontaktování vedení')
          .setDescription('Vyberte prosím typ požadavku.');

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('management_menu')
            .setPlaceholder('Vyberte kategorii')
            .addOptions([
              { label: 'Nahlášení člena týmu', value: 'staff_report' },
              { label: 'Stížnost', value: 'complaint' },
              { label: 'Žádost o spolupráci', value: 'partnership' },
              { label: 'Jiné', value: 'other' }
            ])
        );

        return interaction.update({
          embeds: [embed],
          components: [row, backButton()]
        });
      }

      if (value === 'mc_question') {
        ticket.category = 'Otázka - MC Server';

        const embed = new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle('🎮 Otázka - MC Server')
          .setDescription('Vyberte prosím kategorii.');

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('mc_menu')
            .setPlaceholder('Vyberte kategorii')
            .addOptions([
              { label: 'Ekonomika', value: 'economy' },
              { label: 'Questy', value: 'quests' },
              { label: 'Claimy', value: 'claims' },
              { label: 'Pravidla', value: 'rules' },
              { label: 'Jiné', value: 'other' }
            ])
        );

        return interaction.update({
          embeds: [embed],
          components: [row, backButton()]
        });
      }

      if (value === 'discord_question') {
        ticket.category = 'Otázka - Discord';

        const embed = new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle('💬 Otázka - Discord')
          .setDescription('Vyberte prosím kategorii.');

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('discord_menu')
            .setPlaceholder('Vyberte kategorii')
            .addOptions([
              { label: 'Role', value: 'roles' },
              { label: 'Ověření', value: 'verify' },
              { label: 'Voice chat', value: 'voice' },
              { label: 'Ticket systém', value: 'tickets' },
              { label: 'Jiné', value: 'other' }
            ])
        );

        return interaction.update({
          embeds: [embed],
          components: [row, backButton()]
        });
      }
    }    if (
      interaction.customId === 'report_player_menu' ||
      interaction.customId === 'bug_report_menu' ||
      interaction.customId === 'appeal_menu' ||
      interaction.customId === 'management_menu' ||
      interaction.customId === 'mc_menu' ||
      interaction.customId === 'discord_menu'
    ) {
      const labels = {
        mods: 'Nepovolené modifikace',
        chat: 'Nevhodné chování v chatu',
        grief: 'Kažení hry',
        spam: 'Spam / reklama',
        fake_staff: 'Vydávání se za tým',

        dupe: 'Dupe glitch',
        visual: 'Visual bug',
        server: 'Server bug',
        command: 'Nefunkční příkaz',
        plugin: 'Problém s pluginem',

        mute: 'Mute',
        ban: 'Ban',
        ipban: 'IP Ban',
        complaint: 'Stížnost',

        staff_report: 'Nahlášení člena týmu',
        partnership: 'Žádost o spolupráci',

        economy: 'Ekonomika',
        quests: 'Questy',
        claims: 'Claimy',
        rules: 'Pravidla',

        roles: 'Role',
        verify: 'Ověření',
        voice: 'Voice chat',
        tickets: 'Ticket systém',

        other: 'Jiné'
      };

      ticket.subcategory = labels[interaction.values[0]];
      const routing = getRouting(ticket);

      let description;

      if (ticket.category === 'Nahlášení hráče') {
        description =
          'Pokud máte k dispozici důkazní materiál k nahlášení hráče, dbejte prosím na to, aby:\n\n' +
          '• nebyl nijak upravený\n' +
          '• obsahoval datum a čas\n' +
          '• nebyl starší než 24 hodin\n\n' +
          'Důkazní materiál nahrajte přímo sem do ticketu jako screenshot/video, případně pošlete odkaz na YouTube, Streamable, Medal nebo Imgur.\n\n' +
          'Nyní prosím vyčkejte na příchod člena:\n\n' +
          `${routing.roles}\n\n` +
          'který se Vám bude věnovat.';
      } else {
        description =
          'Nyní prosím vyčkejte na příchod člena:\n\n' +
          `${routing.roles}\n\n` +
          'který se Vám bude věnovat.';
      }

      const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle(`${ticket.category} - ${ticket.subcategory}`)
        .setDescription(description);

      return interaction.update({
        embeds: [embed],
        components: [finalButtons()]
      });
    }
  }

  if (interaction.isButton()) {
    const ticket = waitingTickets.get(interaction.channel.id);

    if (!ticket) {
      return interaction.reply({
        content: '❌ Tento ticket už není aktivní.',
        ephemeral: true
      });
    }

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
      const routing = getRouting(ticket);

      await interaction.channel.setName(
        `${routing.emoji}・${ticket.username}`
      ).catch(() => {});

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('📌 Ticket čeká na převzetí')
            .setDescription(
              `Hráč: <@${ticket.userId}>\n` +
              `Kategorie: ${ticket.category}\n` +
              `Podkategorie: ${ticket.subcategory}\n\n` +
              `Ticket řeší:\n${routing.roles}`
            )
        ],
        components: [staffButtons()]
      });
    }

    if (interaction.customId === 'claim_ticket') {
      ticket.claimedBy = interaction.user.id;

      await interaction.channel.setName(
        `🟨・${ticket.username}`
      ).catch(() => {});

      return interaction.reply({
        content: `🟨 Ticket převzal ${interaction.user}.`
      });
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply({
        content: '🔒 Ticket bude za 5 sekund uzavřen.'
      });

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }
  }
});

client.login(process.env.TOKEN);