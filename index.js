import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  Collection,
  PartialGroupDMChannel,
} from "discord.js";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Put your bot token here OR set the DISCORD_BOT_TOKEN environment variable
const TOKEN = process.env.DISCORD_BOT_TOKEN || "PUT_YOUR_TOKEN_HERE";

// ─── IN-MEMORY SETTINGS (for /impersonate and keyword chaos) ──────────────────
const settings = {
  impersonateEnabled: false,
  impersonateUserId: null,
  impersonateChannelId: null,
  keywords: [],
};

// ─── NUKE PING MESSAGES ───────────────────────────────────────────────────────
const NUKE_MESSAGES = [
  "WAKE UP", "HEY HEY HEY", "HELLO???", "YOU THERE?",
  "👀👀👀", "🚨🚨🚨", "PING PING PING", "RISE AND SHINE",
  "YOUR PHONE IS DYING", "BEEP BOOP", "EARTH TO YOU",
  "THE BOT HAS SPOKEN", "CHECK YOUR PHONE", "IMPORTANT MESSAGE",
  "STILL HERE", "YOO", "YOOOOOOO", "🔔🔔🔔", "DID YOU SEE THIS",
];

// ─── COMMAND DEFINITIONS ──────────────────────────────────────────────────────
const commands = new Collection();

function reg(data, execute) {
  commands.set(data.name, { data, execute });
}

// /spam
reg(
  new SlashCommandBuilder()
    .setName("spam")
    .setDescription("Spam a message in the channel")
    .addStringOption((o) =>
      o.setName("message").setDescription("Message to spam").setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("How many times (1-1000)").setRequired(true).setMinValue(1).setMaxValue(1000),
    ),
  async (interaction) => {
    const message = interaction.options.getString("message", true);
    const amount  = interaction.options.getInteger("amount", true);
    const text    = `${message} (MANTA ON TOP)`;

    await interaction.reply({ content: `📨 Spamming **${amount}x**: ${text}`, ephemeral: true });

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel instanceof PartialGroupDMChannel) return;

    // ~5 msg/s burst, pause every 5 to stay under rate limits
    for (let i = 0; i < amount; i++) {
      await channel.send(text);
      if ((i + 1) % 5 === 0) await sleep(1100);
    }
  },
);

// /deleteall
reg(
  new SlashCommandBuilder()
    .setName("deleteall")
    .setDescription("☢️ Nuke everything — channels, categories, roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async (interaction) => {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: "Server only.", ephemeral: true });

    await interaction.reply({ content: "☢️ Nuking in 3... 2... 1...", ephemeral: true });

    const channels = await guild.channels.fetch();

    // Delete non-categories first, then categories
    for (const [, ch] of channels.filter((c) => c && c.type !== ChannelType.GuildCategory)) {
      try { await ch.delete("deleteall"); } catch {}
    }
    for (const [, ch] of channels.filter((c) => c && c.type === ChannelType.GuildCategory)) {
      try { await ch.delete("deleteall"); } catch {}
    }

    // Delete all non-managed, non-default roles
    const roles = await guild.roles.fetch();
    for (const [, role] of roles) {
      if (role.managed || role.name === "@everyone") continue;
      try { await role.delete("deleteall"); } catch {}
    }

    // Drop a survivor channel
    try {
      const ch = await guild.channels.create({ name: "rip-server", type: ChannelType.GuildText });
      await ch.send("☢️ **Server has been nuked. RIP. Nothing survived.** (MANTA ON TOP)\n> *deleteall was used. Moment of silence.*");
    } catch {}
  },
);

// /kickall
reg(
  new SlashCommandBuilder()
    .setName("kickall")
    .setDescription("Kick everyone except whitelisted users")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName("keep1").setDescription("Keep user 1").setRequired(false))
    .addUserOption((o) => o.setName("keep2").setDescription("Keep user 2").setRequired(false))
    .addUserOption((o) => o.setName("keep3").setDescription("Keep user 3").setRequired(false))
    .addUserOption((o) => o.setName("keep4").setDescription("Keep user 4").setRequired(false))
    .addUserOption((o) => o.setName("keep5").setDescription("Keep user 5").setRequired(false)),
  async (interaction) => {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: "Server only.", ephemeral: true });

    const whitelist = new Set([interaction.client.user.id, interaction.user.id]);
    for (let i = 1; i <= 5; i++) {
      const u = interaction.options.getUser(`keep${i}`);
      if (u) whitelist.add(u.id);
    }

    await interaction.deferReply({ ephemeral: true });

    const members = await guild.members.fetch();
    let kicked = 0, failed = 0;

    for (const [, member] of members.filter((m) => !m.user.bot && !whitelist.has(m.id))) {
      try { await member.kick("kickall"); kicked++; } catch { failed++; }
    }

    await interaction.editReply({ content: `👢 Kicked **${kicked}** members. Failed: ${failed}. Kept: ${whitelist.size}.` });
  },
);

// /nuke
reg(
  new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("Nuke someone's phone with mentions")
    .addUserOption((o) => o.setName("user").setDescription("Target").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("Pings (1-20)").setRequired(false).setMinValue(1).setMaxValue(20)),
  async (interaction) => {
    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount") ?? 10;

    await interaction.reply({ content: `☢️ Nuking <@${target.id}> x${amount}...`, ephemeral: true });

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel instanceof PartialGroupDMChannel) return;

    for (let i = 0; i < amount; i++) {
      await channel.send(`<@${target.id}> ${NUKE_MESSAGES[i % NUKE_MESSAGES.length]}`);
      await sleep(600);
    }
  },
);

// /fakeban
reg(
  new SlashCommandBuilder()
    .setName("fakeban")
    .setDescription("Send a scary fake ban message")
    .addUserOption((o) => o.setName("user").setDescription("User to fake-ban").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Ban reason").setRequired(false)),
  async (interaction) => {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "Being too cringe";

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🔨 User Permanently Banned")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "User",           value: `<@${target.id}> (${target.username})`, inline: true },
        { name: "Reason",         value: reason,                                 inline: true },
        { name: "Duration",       value: "Permanent",                            inline: true },
        { name: "Action taken by", value: "Server Moderation Bot",               inline: false },
      )
      .setFooter({ text: "Discord Trust & Safety • This action cannot be appealed" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
);

// /announce
reg(
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Fake @everyone server announcement")
    .addStringOption((o) => o.setName("message").setDescription("Announcement text").setRequired(true)),
  async (interaction) => {
    const message = interaction.options.getString("message", true);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📢 Official Server Announcement")
      .setDescription(message)
      .setFooter({ text: "Server Staff • Official Announcement", iconURL: interaction.guild?.iconURL() ?? undefined })
      .setTimestamp();

    await interaction.reply({ content: "✅ Sent!", ephemeral: true });
    const channel = interaction.channel;
    if (channel && !(channel instanceof PartialGroupDMChannel)) {
      await channel.send({ content: "@everyone", embeds: [embed] });
    }
  },
);

// /impersonate
reg(
  new SlashCommandBuilder()
    .setName("impersonate")
    .setDescription("Repeat everything a user says (leave empty to stop)")
    .addUserOption((o) => o.setName("user").setDescription("User to parrot (empty = stop)").setRequired(false)),
  async (interaction) => {
    const target = interaction.options.getUser("user");
    if (!target) {
      settings.impersonateEnabled = false;
      settings.impersonateUserId  = null;
      settings.impersonateChannelId = null;
      return interaction.reply({ content: "🦜 Impersonation stopped.", ephemeral: true });
    }
    settings.impersonateEnabled   = true;
    settings.impersonateUserId    = target.id;
    settings.impersonateChannelId = interaction.channelId;
    await interaction.reply({ content: `🦜 Now parroting <@${target.id}> in this channel.`, ephemeral: true });
  },
);

// ─── CLIENT ───────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  // Register slash commands globally (may take up to 1hr to appear everywhere;
  // instant in any guild you kick & re-invite the bot to)
  const rest = new REST().setToken(TOKEN);
  const body = [...commands.values()].map((cmd) => cmd.data.toJSON());
  await rest.put(Routes.applicationCommands(c.user.id), { body });
  console.log(`⚡ Registered ${body.length} slash commands`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`[${interaction.commandName}]`, err);
    const msg = { content: "❌ Something went wrong.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Impersonation
  if (
    settings.impersonateEnabled &&
    settings.impersonateUserId === message.author.id &&
    settings.impersonateChannelId === message.channelId
  ) {
    try {
      await message.channel.send(
        `🦜 **${message.member?.displayName ?? message.author.username}** said: ${message.content}`,
      );
    } catch {}
  }

  // Keyword chaos
  for (const rule of (Array.isArray(settings.keywords) ? settings.keywords : [])) {
    if (message.content.toLowerCase().includes(rule.keyword.toLowerCase())) {
      try { await message.channel.send(rule.response); } catch {}
      break;
    }
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
if (TOKEN === "PUT_YOUR_TOKEN_HERE") {
  console.error("❌ Set your bot token! Edit index.js or run: DISCORD_BOT_TOKEN=your_token node index.js");
  process.exit(1);
}

client.login(TOKEN);

// ─── UTILS ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
