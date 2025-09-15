import 'dotenv/config';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import readline from 'readline';

// Load environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';

// FAQs
const FAQS = {
    "hours": "We are open 9am–6pm (Mon–Fri).",
    "pricing": "Pricing depends on the plan — check our website for details.",
    "support": "Support: support@example.com or call +1-800-555-1234."
};

// Utility function
async function safeGet(url, params = {}) {
    try {
        const res = await axios.get(url, { params });
        return res.data;
    } catch (err) {
        return null;
    }
}

// Handlers
async function handleFaq(query) {
    const key = query?.trim()?.toLowerCase();
    if (!key) return "Please ask a question like: /faq hours";
    return FAQS[key] || "Sorry, I don't have an answer for that FAQ.";
}

async function handleJoke() {
    try {
        const data = await safeGet('https://official-joke-api.appspot.com/random_joke');
        return `${data.setup}\n${data.punchline}`;
    } catch {
        return "I couldn't fetch a joke right now.";
    }
}

async function handleWeather(city) {
    if (!city) return "Usage: /weather <city>";
    if (!OPENWEATHER_API_KEY) return "Weather API key missing in .env";
    try {
        const d = await safeGet('https://api.openweathermap.org/data/2.5/weather', {
            q: city,
            appid: OPENWEATHER_API_KEY,
            units: "metric"
        });
        return `Weather in ${d.name}: ${d.weather[0].description}, Temp: ${d.main.temp}°C`;
    } catch {
        return `Could not fetch weather for '${city}'`;
    }
}

async function handleNews(topic) {
    if (!NEWSAPI_KEY) return "News API key missing in .env";
    const q = topic || "technology";
    try {
        const d = await safeGet('https://newsapi.org/v2/everything', {
            q,
            apiKey: NEWSAPI_KEY,
            pageSize: 3,
            language: "en"
        });
        if (!d.articles?.length) return "No articles found.";
        return d.articles.map((a, i) => `${i + 1}. ${a.title} — ${a.source.name}`).join("\n");
    } catch {
        return "Failed to fetch news.";
    }
}

// Command Router
async function routeCommand(text, sendReply) {
    const parts = text.trim().split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const arg = parts.slice(1).join(" ");

    switch (cmd) {
        case "/start":
        case "start":
            return sendReply("Hi! Try /faq <topic>, /joke, /weather <city>, or /news <topic>");
        case "/faq":
        case "faq":
            return sendReply(await handleFaq(arg));
        case "/joke":
        case "joke":
            return sendReply(await handleJoke());
        case "/weather":
        case "weather":
            return sendReply(await handleWeather(arg));
        case "/news":
        case "news":
            return sendReply(await handleNews(arg));
        default:
            return sendReply("I didn’t understand. Try: /faq, /joke, /weather, /news");
    }
}

// Telegram Bot Mode
if (process.argv.indexOf('--cli') === -1) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log("⚠️ No TELEGRAM_BOT_TOKEN found. Run with --cli for testing.");
    } else {
        const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

        bot.on("text", async (ctx) => {
            await routeCommand(ctx.message.text, (reply) => ctx.reply(reply));
        });

        bot.launch().then(() => console.log("✅ Telegram bot started"));
        process.once("SIGINT", () => bot.stop("SIGINT"));
        process.once("SIGTERM", () => bot.stop("SIGTERM"));
    }
}

// CLI Mode
if (process.argv.indexOf('--cli') !== -1) {
    console.log("💻 CLI mode: try `start`, `faq hours`, `joke`, `weather Dhaka`, `news AI`");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.setPrompt("> ");
    rl.prompt();

    rl.on("line", async (line) => {
        await routeCommand(line, (reply) => console.log("\n" + reply + "\n"));
        rl.prompt();
    });
}
