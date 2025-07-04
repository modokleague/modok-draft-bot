const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const ALLOWED_CHANNELS = ['1265034442246983754', '1390518364564099273'];
const ENABLE_CHANNEL_RESTRICTIONS = true;

function isChannelAllowed(channelId) {
    if (!ENABLE_CHANNEL_RESTRICTIONS) return true;
    return ALLOWED_CHANNELS.includes(channelId);
}

const bannedHeroes = ['Maria Hill - Leadership', 'Cyclops - Leadership', 'Cable - Leadership', 'Doctor Strange - Protection', 'Adam Warlock', 'Gamora - Aggression'];

const draftOrder = ['Spider-Ham - Justice', 'Cable - Leadership', 'Cyclops', 'Storm - Leadership', 'Magik - Aggression', 'Psylocke - Justice', 'Maria Hill - Leadership', 'Bishop - Leadership', 'Spider-Man (Peter Parker) - Justice', 'Doctor Strange - Protection', 'Spider-Man (Miles Morales) - Justice', 'Captain Marvel - Leadership', 'Scarlet Witch - Justice', 'X-23 - Aggression', 'Deadpool - Pool', 'Black Panther (Shuri) - Justice', 'Magneto - Leadership', 'Ironheart - Leadership', 'Vision - Protection', 'Captain America - Leadership', 'Domino - Justice', 'Angel - Protection', 'Shadowcat - Aggression', 'Nova - Aggression', 'Nick Fury - Justice', 'Iron Man - Aggression', 'Silk - Protection', 'Spider-Woman - Aggression / Justice', 'SP//dr - Protection', 'Phoenix - Justice', 'Wolverine - Aggression', 'Venom - Justice', 'Rogue - Protection', "Black Panther (T'Challa) - Protection", 'Ant-Man - Leadership', 'Star-Lord - Leadership', 'Spectrum - Leadership', 'Colossus - Protection', 'Jubilee - Justice', 'Gambit - Justice', 'Iceman - Aggression', 'Rocket - Aggression', 'Falcon - Leadership', 'Winter Soldier - Aggression', 'Adam Warlock', 'Gamora - Aggression', 'Ghost-Spider - Protection', 'Drax - Protection', 'Black Widow - Justice', 'Nightcrawler - Protection', 'Wasp - Aggression', 'Ms Marvel - Protection', 'Nebula - Justice', 'She-Hulk - Aggression', 'Thor - Aggression', 'War Machine - Leadership', 'Quicksilver - Protection', 'Hawkeye - Leadership', 'Groot - Protection', 'Valkyrie - Aggression', 'Hulk - Aggression'];

function isHeroBanned(heroName) {
    if (bannedHeroes.includes(heroName)) return true;
    const heroBaseName = heroName.split(' - ')[0];
    for (const bannedHero of bannedHeroes) {
        const bannedBaseName = bannedHero.split(' - ')[0];
        if (heroBaseName === bannedBaseName) return true;
    }
    return false;
}

const filteredDraftOrder = draftOrder.filter(hero => !isHeroBanned(hero));

const teamNamePools = {
    0: ['Aaron Davis', 'Abigail Brand', 'Adrian Toomes', 'Amora', 'Arnim Zola'],
    1: ['Betty Ross', 'Bullseye', 'Bruno Carrelli', 'Baron Mordo', 'Beetle'],
    2: ['Calvin Zabo', 'Cassandra Nova', 'Curt Connors', 'Clea', 'Carl "Crusher" Creel'],
    3: ['Doctor Doom', 'Donald Pierce', 'Dormammu', 'Daken', 'Danny Rand'],
    4: ['Edwin Jarvis', 'Elektra', 'Emil Blonsky', 'Everett Ross', 'Ebony Maw'],
    5: ['Felicia Hardy', 'Fin Fang Foom', 'Frank Castle', 'Franklin Richards', 'Frigga'],
    6: ['Gwen Stacy', 'George Stacy', 'Gorgon', 'Giganto', 'Gilgamesh'],
    7: ['Harry Osborn', 'Howard Stark', 'Hope Pym', 'Hobgoblin', 'Helmut Zemo'],
    8: ['Illyana Rasputin', 'Imperial Guard', 'Iron Fist'],
    9: ['J Jonah Jameson', 'Janet Van Dyne', 'Jessica Jones', 'Jacosta', 'Jamie Madrox']
};

class Random {
    constructor(seed = Math.random()) {
        if (typeof seed === 'string') {
            this.seed = this.stringToHash(seed);
        } else {
            this.seed = this.hash(seed.toString());
        }
    }

    stringToHash(str) {
        if (str === '') return 0;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    next() {
        this.seed = (1664525 * this.seed + 1013904223) >>> 0;
        return this.seed / 0xFFFFFFFF;
    }
}

function shuffleArray(array, rng) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function getHeroAspect(heroName) {
    if (heroName.includes(' - ')) {
        const aspect = heroName.split(' - ')[1].toLowerCase();
        if (aspect.includes('/')) {
            return aspect.split(' / ')[0];
        }
        return aspect;
    }
    if (heroName.includes('Pool')) return 'pool';
    if (heroName === 'Adam Warlock') return 'basic';
    return 'unknown';
}

const draftSessions = new Map();
const draftMessages = new Map();

class DraftSession {
    constructor(channelId, options) {
        this.channelId = channelId;
        this.numberOfTeams = options.numberOfTeams || 10;
        this.seed = options.seed || Math.random();
        this.poolSize = options.poolSize || 'standard';
        this.customPoolSize = options.customPoolSize || 35;
        this.playerUserId = options.playerUserId;
        
        if (options.userTeamName) {
            this.userTeamName = options.userTeamName;
        } else {
            const aTeamPool = teamNamePools[0] || ['Aaron Davis'];
            const randomIndex = Math.floor(Math.random() * aTeamPool.length);
            this.userTeamName = aTeamPool[randomIndex];
        }
        
        this.rng = new Random(this.seed);
        this.heroPool = [];
        this.draftOrderTeams = [];
        this.teamPicks = {};
        this.currentTurnIndex = 0;
        this.currentRound = 1;
        this.maxRounds = 2;
        this.draftedHeroes = [];
        this.isActive = false;
        
        this.generatePool();
    }

generatePool() {
        let numberOfHeroes;
        switch (this.poolSize) {
            case 'standard':
                numberOfHeroes = 2 * this.numberOfTeams + 15;
                break;
            case 'large':
                numberOfHeroes = 2 * this.numberOfTeams + 25;
                break;
            case 'custom':
                numberOfHeroes = this.customPoolSize;
                break;
        }
        
        const heroesPool = [...filteredDraftOrder];
        shuffleArray(heroesPool, this.rng);
        this.heroPool = heroesPool.slice(0, numberOfHeroes).sort();
        
        const numberOfActualTeams = this.numberOfTeams - 1;
        const teams = Array.from({ length: numberOfActualTeams }, (_, i) => {
            if (teamNamePools[i + 1]) {
                const namePool = [...teamNamePools[i + 1]];
                const randomIndex = Math.floor(this.rng.next() * namePool.length);
                return namePool[randomIndex];
            } else {
                return `Team ${String.fromCharCode(66 + i)}`;
            }
        });
        
        teams.push(this.userTeamName);
        shuffleArray(teams, this.rng);
        this.draftOrderTeams = teams;
        
        teams.forEach(team => {
            this.teamPicks[team] = [];
        });
    }
    
    isPlayerTurn() {
        if (!this.userTeamName) return false;
        if (this.isComplete()) return false;
        return this.draftOrderTeams[this.currentTurnIndex] === this.userTeamName;
    }
    
    getCurrentTeam() {
        return this.draftOrderTeams[this.currentTurnIndex];
    }
    
    getAvailableHeroes() {
        return this.heroPool.filter(hero => !this.draftedHeroes.includes(hero));
    }
    
    getUndraftedHeroes() {
        return this.heroPool.filter(hero => !this.draftedHeroes.includes(hero));
    }
    
    getExcludedHeroes() {
        return filteredDraftOrder.filter(hero => !this.heroPool.includes(hero));
    }
    
    draftHero(heroName) {
        if (this.draftedHeroes.includes(heroName)) return false;
        const currentTeam = this.getCurrentTeam();
        this.teamPicks[currentTeam].push(heroName);
        this.draftedHeroes.push(heroName);
        this.advanceTurn();
        return true;
    }
    
    advanceTurn() {
        if (this.currentRound === 1) {
            this.currentTurnIndex++;
            if (this.currentTurnIndex >= this.draftOrderTeams.length) {
                this.currentRound = 2;
                this.currentTurnIndex = this.draftOrderTeams.length - 1;
            }
        } else if (this.currentRound === 2) {
            this.currentTurnIndex--;
            if (this.currentTurnIndex < 0) {
                this.currentRound = 3;
                this.isActive = false;
                console.log('Draft completed, moving to summary display');
            }
        }
    }
    
    isComplete() {
        return this.currentRound > this.maxRounds;
    }

makeAIPick() {
        const availableHeroes = this.getAvailableHeroes();
        if (availableHeroes.length === 0) return null;
        
        const currentTeam = this.getCurrentTeam();
        const teamHeroes = this.teamPicks[currentTeam] || [];
        const teamAspects = teamHeroes.map(hero => getHeroAspect(hero));
        
        let aiPick = null;
        
        if (Math.random() < 0.15) {
            const randomIndex = Math.floor(Math.random() * availableHeroes.length);
            aiPick = availableHeroes[randomIndex];
        } else {
            const availablePriorityHeroes = filteredDraftOrder.filter(hero => availableHeroes.includes(hero));
            
            if (availablePriorityHeroes.length > 0) {
                const topChoices = availablePriorityHeroes.slice(0, Math.min(5, availablePriorityHeroes.length));
                const weights = [];
                for (let i = 0; i < topChoices.length; i++) {
                    weights.push(Math.pow(1.5, topChoices.length - 1 - i));
                }
                
                const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
                const random = Math.random() * totalWeight;
                let cumulativeWeight = 0;
                
                for (let i = 0; i < topChoices.length; i++) {
                    cumulativeWeight += weights[i];
                    if (random <= cumulativeWeight) {
                        aiPick = topChoices[i];
                        break;
                    }
                }
            } else {
                const randomIndex = Math.floor(Math.random() * availableHeroes.length);
                aiPick = availableHeroes[randomIndex];
            }
        }
        
        if (aiPick && teamHeroes.length === 1) {
            const pickAspect = getHeroAspect(aiPick);
            if (teamAspects.includes(pickAspect)) {
                const randomIndex = Math.floor(Math.random() * availableHeroes.length);
                aiPick = availableHeroes[randomIndex];
            }
        }
        
        return aiPick;
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName('draft')
        .setDescription('Start a new MODOK League draft')
        .addIntegerOption(option => option.setName('teams').setDescription('Number of teams (6-10)').setMinValue(6).setMaxValue(10))
        .addStringOption(option => option.setName('seed').setDescription('Custom seed for reproducible results'))
        .addStringOption(option => option.setName('teamname').setDescription('Your team name'))
        .addStringOption(option => option.setName('poolsize').setDescription('Pool size mode').addChoices({ name: 'Standard (2×Teams + 15)', value: 'standard' }, { name: 'Large (2×Teams + 25)', value: 'large' }, { name: 'Custom', value: 'custom' }))
        .addIntegerOption(option => option.setName('customsize').setDescription('Custom pool size (only if poolsize is custom)').setMinValue(10).setMaxValue(70)),
    
    new SlashCommandBuilder().setName('pool').setDescription('Generate hero pool without starting draft').addIntegerOption(option => option.setName('teams').setDescription('Number of teams (6-10)').setMinValue(6).setMaxValue(10)).addStringOption(option => option.setName('seed').setDescription('Custom seed for reproducible results')),
    
    new SlashCommandBuilder().setName('pick').setDescription('Pick a hero during your turn').addStringOption(option => option.setName('hero').setDescription('Hero name to pick').setRequired(true).setAutocomplete(true)),
    
    new SlashCommandBuilder().setName('status').setDescription('Show current draft status'),
    
    new SlashCommandBuilder().setName('quit').setDescription('End the current draft session')
];

function createPoolEmbed(session) {
    const embed = new EmbedBuilder()
        .setTitle('🎯 MODOK League S3.5 - Hero Pool Generated')
        .setColor('#ff6b6b')
        .addFields({ name: '📋 Pool Information', value: `**Heroes in Pool:** ${session.heroPool.length}\n**Teams:** ${session.numberOfTeams}\n**Seed:** ${session.seed}`, inline: false }, { name: '🏆 Draft Order', value: session.draftOrderTeams.map((team, i) => `${i + 1}. ${team}`).join('\n'), inline: true });
    
    const chunkSize = 20;
    for (let i = 0; i < session.heroPool.length; i += chunkSize) {
        const chunk = session.heroPool.slice(i, i + chunkSize);
        embed.addFields({ name: i === 0 ? '🦸 Hero Pool' : '🦸 Hero Pool (cont.)', value: chunk.join('\n'), inline: true });
    }
    return embed;
}

function createDraftEmbed(session) {
    const embed = new EmbedBuilder().setTitle('🎯 MODOK League Draft - Round ' + session.currentRound).setColor(session.isPlayerTurn() ? '#ff6b6b' : '#8A2BE2');
    
    if (session.isComplete()) {
        embed.setTitle('🎉 Draft Complete!').setColor('#28a745').setDescription('**Draft finished!** This session will automatically close in 10 seconds.\n\nFinal results are shown below:');
    } else {
        const currentTeam = session.getCurrentTeam();
        const isPlayer = session.isPlayerTurn();
        embed.setDescription(isPlayer ? `**Your turn!** Pick a hero using \`/pick <hero>\` or click a button below` : `**${currentTeam}** is picking...`);
    }
    
    let teamPicksText = '';
    session.draftOrderTeams.forEach((team, i) => {
        const picks = session.teamPicks[team] || [];
        const isCurrentTeam = i === session.currentTurnIndex && !session.isComplete();
        const isPlayerTeam = team === session.userTeamName;
        let teamPrefix = '';
        if (isCurrentTeam) teamPrefix = '👉 ';
        if (isPlayerTeam) teamPrefix += '🎯 **YOU** - ';
        teamPicksText += `${teamPrefix}**${team}:** ${picks.length > 0 ? picks.join(', ') : 'No picks yet'}\n`;
    });
    
    embed.addFields({ name: '👥 Team Picks', value: teamPicksText || 'No picks yet', inline: false });
    
    if (session.isComplete()) {
        const undraftedHeroes = session.getUndraftedHeroes();
        const excludedHeroes = session.getExcludedHeroes();
        
        if (undraftedHeroes.length > 0) {
            const chunkSize = 20;
            for (let i = 0; i < undraftedHeroes.length; i += chunkSize) {
                const chunk = undraftedHeroes.slice(i, i + chunkSize);
                const fieldName = i === 0 ? `📋 Undrafted Heroes (${undraftedHeroes.length} total)` : `📋 Undrafted Heroes (continued)`;
                embed.addFields({ name: fieldName, value: chunk.join('\n'), inline: true });
            }
        }
        
        if (excludedHeroes.length > 0) {
            const chunkSize = 20;
            for (let i = 0; i < excludedHeroes.length; i += chunkSize) {
                const chunk = excludedHeroes.slice(i, i + chunkSize);
                const fieldName = i === 0 ? `🚫 Excluded from Pool (${excludedHeroes.length} total)` : `🚫 Excluded from Pool (continued)`;
                embed.addFields({ name: fieldName, value: chunk.join('\n'), inline: true });
            }
        }
        
        const totalHeroes = filteredDraftOrder.length;
        const poolSize = session.heroPool.length;
        const draftedCount = session.draftedHeroes.length;
        embed.addFields({ name: '📊 Draft Statistics', value: `**Total Heroes Available:** ${totalHeroes}\n**Pool Size:** ${poolSize}\n**Heroes Drafted:** ${draftedCount}\n**Heroes Undrafted:** ${undraftedHeroes.length}\n**Heroes Excluded:** ${excludedHeroes.length}`, inline: false });
        
    } else {
        const availableHeroes = session.getAvailableHeroes();
        const draftedHeroes = session.draftedHeroes;
        const allHeroesInPool = session.heroPool;
        
        const botPriorityInPool = filteredDraftOrder.filter(hero => allHeroesInPool.includes(hero));
        
        if (botPriorityInPool.length > 0) {
            const chunkSize = 15;
            for (let i = 0; i < botPriorityInPool.length; i += chunkSize) {
                const chunk = botPriorityInPool.slice(i, i + chunkSize);
                const formattedChunk = chunk.map(hero => draftedHeroes.includes(hero) ? `~~${hero}~~` : hero);
                const fieldName = i === 0 ? `⭐ Bot Priority Heroes (${botPriorityInPool.length} total)` : `⭐ Bot Priority Heroes (continued)`;
                embed.addFields({ name: fieldName, value: formattedChunk.join('\n'), inline: true });
            }
        }
        
        if (allHeroesInPool.length > 0) {
            const chunkSize = 20;
            for (let i = 0; i < allHeroesInPool.length; i += chunkSize) {
                const chunk = allHeroesInPool.slice(i, i + chunkSize);
                const formattedChunk = chunk.map(hero => draftedHeroes.includes(hero) ? `~~${hero}~~` : hero);
                const fieldName = i === 0 ? `🦸 All Heroes in Pool (${allHeroesInPool.length} total)` : `🦸 All Heroes in Pool (continued)`;
                embed.addFields({ name: fieldName, value: formattedChunk.join('\n'), inline: true });
            }
        }
        
        embed.addFields({ name: '📊 Draft Progress', value: `**Available to Pick:** ${availableHeroes.length}\n**Already Drafted:** ${draftedHeroes.length}\n**Total in Pool:** ${allHeroesInPool.length}`, inline: false });
    }
    
    return embed;
}

function createActionRow(session) {
    if (session.isComplete() || !session.isPlayerTurn()) return null;
    const availableHeroes = session.getAvailableHeroes();
    const availablePriorityHeroes = filteredDraftOrder.filter(hero => availableHeroes.includes(hero));
    const topHeroes = availablePriorityHeroes.slice(0, 5);
    if (topHeroes.length === 0) return null;
    const buttons = topHeroes.map((hero, i) => new ButtonBuilder().setCustomId(`pick_${hero}`).setLabel(hero.length > 80 ? hero.substring(0, 77) + '...' : hero).setStyle(ButtonStyle.Primary));
    return new ActionRowBuilder().addComponents(buttons);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.application.commands.set(commands);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
    } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
    }
});

async function handleSlashCommand(interaction) {
    const { commandName } = interaction;
    if (!isChannelAllowed(interaction.channelId)) {
        await interaction.reply({ content: '❌ This bot can only be used in designated channels.', ephemeral: true });
        return;
    }
    
    try {
        switch (commandName) {
            case 'draft': await handleDraftCommand(interaction); break;
            case 'pool': await handlePoolCommand(interaction); break;
            case 'pick': await handlePickCommand(interaction); break;
            case 'status': await handleStatusCommand(interaction); break;
            case 'quit': await handleQuitCommand(interaction); break;
        }
    } catch (error) {
        console.error('Error handling command:', error);
        await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
    }
}

async function handleDraftCommand(interaction) {
    const channelId = interaction.channelId;
    if (draftSessions.has(channelId)) {
        await interaction.reply({ content: 'A draft is already active in this channel! Use `/quit` to end it first.', ephemeral: true });
        return;
    }
    
    const options = {
        numberOfTeams: interaction.options.getInteger('teams') || 10,
        seed: interaction.options.getString('seed') || Math.random(),
        userTeamName: interaction.options.getString('teamname'),
        poolSize: interaction.options.getString('poolsize') || 'standard',
        customPoolSize: interaction.options.getInteger('customsize') || 35,
        playerUserId: interaction.user.id
    };
    
    const session = new DraftSession(channelId, options);
    session.isActive = true;
    draftSessions.set(channelId, session);
    
    const embed = createDraftEmbed(session);
    const actionRow = createActionRow(session);
    const response = { embeds: [embed] };
    if (actionRow) response.components = [actionRow];
    
    const reply = await interaction.reply(response);
    draftMessages.set(channelId, reply.id);
    
    if (!session.isPlayerTurn() && !session.isComplete()) {
        setTimeout(() => processAITurn(interaction, session), 2000);
    }
}

async function handlePoolCommand(interaction) {
    const options = {
        numberOfTeams: interaction.options.getInteger('teams') || 10,
        seed: interaction.options.getString('seed') || Math.random()
    };
    const session = new DraftSession(interaction.channelId, options);
    const embed = createPoolEmbed(session);
    await interaction.reply({ embeds: [embed] });
}

async function handlePickCommand(interaction) {
    const channelId = interaction.channelId;
    const session = draftSessions.get(channelId);
    
    if (!session) {
        await interaction.reply({ content: 'No active draft in this channel. Start one with `/draft`', ephemeral: true });
        return;
    }
    
    if (!session.isPlayerTurn()) {
        await interaction.reply({ content: 'It\'s not your turn!', ephemeral: true });
        return;
    }
    
    const heroName = interaction.options.getString('hero');
    const availableHeroes = session.getAvailableHeroes();
    const matchedHero = availableHeroes.find(hero => hero.toLowerCase().includes(heroName.toLowerCase()) || heroName.toLowerCase().includes(hero.toLowerCase()));
    
    if (!matchedHero) {
        await interaction.reply({ content: `Hero "${heroName}" not found or already drafted.`, ephemeral: true });
        return;
    }
    
    session.draftHero(matchedHero);
    
    const embed = createDraftEmbed(session);
    const actionRow = createActionRow(session);
    const response = { embeds: [embed] };
    if (actionRow) response.components = [actionRow];
    
    try {
        await interaction.editReply(response);
    } catch (error) {
        await interaction.reply(response);
    }
    
    if (session.isComplete()) {
        setTimeout(async () => {
            const finalEmbed = createDraftEmbed(session);
            const finalResponse = { embeds: [finalEmbed] };
            try {
                await interaction.editReply(finalResponse);
                console.log('Final draft summary displayed after player pick');
            } catch (error) {
                console.error('Failed to show final summary after player pick:', error);
            }
            setTimeout(() => {
                draftSessions.delete(channelId);
                draftMessages.delete(channelId);
                console.log(`Draft completed and cleaned up for channel: ${channelId}`);
            }, 10000);
        }, 1000);
        return;
    }
    
    if (!session.isPlayerTurn() && !session.isComplete()) {
        setTimeout(() => processAITurn(interaction, session), 2000);
    }
}

async function handleStatusCommand(interaction) {
    const session = draftSessions.get(interaction.channelId);
    if (!session) {
        await interaction.reply({ content: 'No active draft in this channel.', ephemeral: true });
        return;
    }
    const embed = createDraftEmbed(session);
    const actionRow = createActionRow(session);
    const response = { embeds: [embed] };
    if (actionRow) response.components = [actionRow];
    await interaction.reply(response);
}

async function handleQuitCommand(interaction) {
    const channelId = interaction.channelId;
    if (!draftSessions.has(channelId)) {
        await interaction.reply({ content: 'No active draft to quit.', ephemeral: true });
        return;
    }
    draftSessions.delete(channelId);
    await interaction.reply({ content: '🛑 Draft session ended.', ephemeral: false });
}

async function handleButtonInteraction(interaction) {
    if (!interaction.customId.startsWith('pick_')) return;
    const heroName = interaction.customId.replace('pick_', '');
    const session = draftSessions.get(interaction.channelId);
    
    if (!session || !session.isPlayerTurn()) {
        await interaction.reply({ content: 'Invalid pick attempt.', ephemeral: true });
        return;
    }
    
    session.draftHero(heroName);
    
    const embed = createDraftEmbed(session);
    const actionRow = createActionRow(session);
    const response = { embeds: [embed] };
    if (actionRow) response.components = [actionRow];
    
    await interaction.update(response);
    
    if (session.isComplete()) {
        setTimeout(async () => {
            const finalEmbed = createDraftEmbed(session);
            const finalResponse = { embeds: [finalEmbed] };
            try {
                await interaction.editReply(finalResponse);
                console.log('Final draft summary displayed after button pick');
            } catch (error) {
                console.error('Failed to show final summary after button pick:', error);
            }
            setTimeout(() => {
                draftSessions.delete(interaction.channelId);
                draftMessages.delete(interaction.channelId);
                console.log(`Draft completed and cleaned up for channel: ${interaction.channelId}`);
            }, 10000);
        }, 1000);
        return;
    }
    
    if (!session.isPlayerTurn() && !session.isComplete()) {
        setTimeout(() => processAITurn(interaction, session), 2000);
    }
}

async function handleAutocomplete(interaction) {
    if (interaction.commandName === 'pick') {
        const session = draftSessions.get(interaction.channelId);
        if (!session) {
            await interaction.respond([]);
            return;
        }
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const availableHeroes = session.getAvailableHeroes();
        const filtered = availableHeroes.filter(hero => hero.toLowerCase().includes(focusedValue)).slice(0, 25).map(hero => ({ name: hero.length > 100 ? hero.substring(0, 97) + '...' : hero, value: hero }));
        await interaction.respond(filtered);
    }
}

async function processAITurn(interaction, session) {
    if (session.isPlayerTurn() || session.isComplete()) {
        if (session.isComplete()) {
            const embed = createDraftEmbed(session);
            const response = { embeds: [embed] };
            try {
                await interaction.editReply(response);
                console.log('Final draft summary displayed');
            } catch (error) {
                console.error('Failed to show final summary:', error);
            }
            setTimeout(() => {
                draftSessions.delete(interaction.channelId);
                draftMessages.delete(interaction.channelId);
                console.log(`Draft completed and cleaned up for channel: ${interaction.channelId}`);
            }, 10000);
        }
        return;
    }
    
    const aiPick = session.makeAIPick();
    if (aiPick) {
        session.draftHero(aiPick);
        
        const embed = createDraftEmbed(session);
        const actionRow = createActionRow(session);
        const response = { embeds: [embed] };
        if (actionRow) response.components = [actionRow];
        
        try {
            await interaction.editReply(response);
        } catch (error) {
            console.error('Failed to edit reply during AI turn:', error);
            try {
                await interaction.followUp(response);
            } catch (followError) {
                console.error('Failed to follow up:', followError);
            }
        }
        
        if (session.isComplete()) {
            setTimeout(async () => {
                const finalEmbed = createDraftEmbed(session);
                const finalResponse = { embeds: [finalEmbed] };
                try {
                    await interaction.editReply(finalResponse);
                    console.log('Final draft summary displayed after AI pick');
                } catch (error) {
                    console.error('Failed to show final summary after AI pick:', error);
                }
                setTimeout(() => {
                    draftSessions.delete(interaction.channelId);
                    draftMessages.delete(interaction.channelId);
                    console.log(`Draft completed and cleaned up for channel: ${interaction.channelId}`);
                }, 10000);
            }, 1000);
            return;
        }
        
        if (!session.isPlayerTurn() && !session.isComplete()) {
            setTimeout(() => processAITurn(interaction, session), 2000);
        } else if (session.isPlayerTurn() && !session.isComplete()) {
            console.log(`Waiting for player turn: ${session.getCurrentTeam()}`);
        }
    }
}

client.login(process.env.DISCORD_TOKEN);
