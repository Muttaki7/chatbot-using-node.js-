import 'dotenv/config';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import readline from 'readline';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';
const FAQS = {
  "hours": "We are open 9am–6pm (Mon–Fri).",
  "pricing": "Pricing depends on the plan — check our website for details.",
  "support": "Support: support@example.com or call +1-800-555-1234."
};

async function safeGet(url, params = {}) {
  try {
    const res = await axios.get(url, { params });
    return res.data;
  } catch (err) {
    console.error('HTTP error:', err?.response?.status, err?.message);
    throw new Error('external-api-error');
  }
}

async function handleFaq(query) {
  const key = query?.trim()?.toLowerCase();
  if (!key) return 'Please ask a question like: /faq hours';
  const answer = FAQS[key];
  return answer || "Sorry, I don't have an answer for that FAQ. Try: hours, pricing, support.";
}

async function handleJoke() {
  try {
    const data = await safeGet('https://official-joke-api.appspot.com/random_joke');
    return `${data.setup}\n${data.punchline}`;
  } catch (e) {
    return "I couldn't fetch a joke right now — but here's one: Why did the developer go broke? Because he used up all his cache.";
  }
}

async function handleWeather(city) {
  if (!city) return 'Usage: /weather <city>

Example: /weather Dhaka';
  if (!OPENWEATHER_API_KEY) return 'Weather API key not configured. Add OPENWEATHER_API_KEY to .env';
  try {
    const d = await safeGet('https://api.openweathermap.org/data/2.5/weather', {
      q: city,
      appid: OPENWEATHER_API_KEY,
      units: 'metric'
    });
    return `Weather for ${d.name}: ${d.weather[0].description}. Temp: ${d.main.temp}°C (feels like ${d.main.feels_like}°C). Humidity: ${d.main.humidity}%`;
  } catch (e) {
    return `Could not fetch weather for '${city}'.`;
  }
}

async function handleNews(topic) {
  if (!NEWSAPI_KEY) return 'News API key not configured. Add NEWSAPI_KEY to .env';
  const q = topic || 'top headlines';
  try {
    const data = await safeGet('https://newsapi.org/v2/everything', {
      q,
      apiKey: NEWSAPI_KEY,
      pageSize: 5,
      language: 'en',
      sortBy: 'publishedAt'
    });
    if (!data.articles || data.articles.length === 0) return 'No recent articles found.';
    const items = data.articles.map((a, i) => `${i+1}. ${a.title} — ${a.source.name}`).join('\n');
    return `Top articles for '${q}':\n${items}`;
  } catch (e) {
    return 'Failed to fetch news at the moment.';
  }
}

async function routeCommand(text, sendReply) {
  const parts = (text || '').trim().split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case '/start':
    case 'start':
      return sendReply('Hello! I can answer FAQs, tell jokes, and fetch weather or news. Try: /faq <topic>, /joke, /weather <city>, /news <topic>');

    case '/faq':
    case 'faq':
      return sendReply(await handleFaq(arg));

    case '/joke':
    case 'joke':
      return sendReply(await handleJoke());

    case '/weather':
    case 'weather':
      return sendReply(await handleWeather(arg));

    case '/news':
    case 'news':
      return sendReply(await handleNews(arg));

    default:
      return sendReply("I didn't understand that. Try /faq, /joke, /weather, /news.");
  }
}

if (process.argv.indexOf('--cli') === -1) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('No TELEGRAM_BOT_TOKEN found in environment. Start with --cli to use CLI mode.');
  } else {
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

    bot.start((ctx) => ctx.reply('Welcome! Type /faq, /joke, /weather <city>, or /news <topic>'));

     bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      await routeCommand(text, (reply) => ctx.reply(reply));
    });

    bot.launch().then(() => console.log('Telegram bot started')).catch(err => console.error('Bot launch failed:', err));

     process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

if (process.argv.indexOf('--cli') !== -1) {
  console.log('Running in CLI mode. Type commands like: start, faq hours, joke, weather Dhaka, news tesla');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  rl.setPrompt('> ');
  rl.prompt();
  rl.on('line', async (line) => {
    await routeCommand(line, (reply) => console.log('\n' + reply + '\n'));
    rl.prompt();
  }).on('close', () => {
    console.log('Goodbye');
    process.exit(0);
  });
}
