
const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { createSupabaseClient, isSupabaseConfigured } = require('./config/supabase');

const app = express();

app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/health', (req, res) => {
    res.json({
        message: 'EduAI Backend работает!',
        status: 'OK'
    });
});

app.get('/api/config', (req, res) => {
    res.json({ authAvailable: isSupabaseConfigured() });
});

function publicUser(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.user_metadata && user.user_metadata.display_name
            ? user.user_metadata.display_name
            : user.email
    };
}

function publicSession(session) {
    if (!session) return null;
    return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at
    };
}

function sendSupabaseError(res, error, fallbackMessage) {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
        ? error.status
        : 400;
    res.status(status).json({ error: error.message || fallbackMessage });
}

app.post('/api/auth/register', async (req, res, next) => {
    try {
        const body = req.body || {};
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (!name || name.length > 80) {
            return res.status(400).json({ error: 'Укажите имя длиной не более 80 символов.' });
        }
        if (!email || email.length > 254 || !email.includes('@')) {
            return res.status(400).json({ error: 'Укажите корректный адрес электронной почты.' });
        }
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({ error: 'Пароль должен содержать от 8 до 72 символов.' });
        }

        const supabase = createSupabaseClient();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: name } }
        });

        if (error) return sendSupabaseError(res, error, 'Не удалось создать аккаунт.');
        res.status(201).json({
            user: data.user ? publicUser(data.user) : null,
            session: publicSession(data.session)
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/auth/login', async (req, res, next) => {
    try {
        const body = req.body || {};
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!email || !password) {
            return res.status(400).json({ error: 'Укажите почту и пароль.' });
        }

        const supabase = createSupabaseClient();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return sendSupabaseError(res, error, 'Не удалось войти.');
        res.json({ user: publicUser(data.user), session: publicSession(data.session) });
    } catch (error) {
        next(error);
    }
});

app.post('/api/auth/refresh', async (req, res, next) => {
    try {
        const refreshToken = req.body && typeof req.body.refreshToken === 'string'
            ? req.body.refreshToken
            : '';
        if (!refreshToken) {
            return res.status(400).json({ error: 'Сессия истекла. Войдите в аккаунт ещё раз.' });
        }

        const supabase = createSupabaseClient();
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (error) return sendSupabaseError(res, error, 'Не удалось обновить сессию.');
        res.json({ user: data.user ? publicUser(data.user) : null, session: publicSession(data.session) });
    } catch (error) {
        next(error);
    }
});

async function requireUser(req, res, next) {
    try {
        const authorization = req.get('authorization') || '';
        const accessToken = authorization.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length)
            : '';
        if (!accessToken) {
            return res.status(401).json({ error: 'Войдите в аккаунт, чтобы продолжить.' });
        }

        const supabase = createSupabaseClient(accessToken);
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (error || !data.user) {
            return res.status(401).json({ error: 'Сессия истекла. Войдите в аккаунт ещё раз.' });
        }

        req.user = data.user;
        req.supabase = supabase;
        req.accessToken = accessToken;
        next();
    } catch (error) {
        next(error);
    }
}

app.get('/api/auth/me', requireUser, (req, res) => {
    res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/logout', requireUser, async (req, res, next) => {
    try {
        const refreshToken = req.body && typeof req.body.refreshToken === 'string'
            ? req.body.refreshToken
            : '';
        if (!refreshToken) {
            return res.status(400).json({ error: 'Не удалось завершить сессию. Войдите в аккаунт ещё раз.' });
        }

        const { error: sessionError } = await req.supabase.auth.setSession({
            access_token: req.accessToken,
            refresh_token: refreshToken
        });
        if (sessionError) return sendSupabaseError(res, sessionError, 'Не удалось завершить сессию.');

        const { error } = await req.supabase.auth.signOut();
        if (error) return sendSupabaseError(res, error, 'Не удалось завершить сессию.');
        res.json({ signedOut: true });
    } catch (error) {
        next(error);
    }
});

app.get('/api/progress', requireUser, async (req, res, next) => {
    try {
        const { data, error } = await req.supabase
            .from('learning_progress')
            .select('course_id, lesson_id, completed_at')
            .eq('user_id', req.user.id);

        if (error) return sendSupabaseError(res, error, 'Не удалось загрузить прогресс.');
        res.json({ progress: data });
    } catch (error) {
        next(error);
    }
});

app.post('/api/progress', requireUser, async (req, res, next) => {
    try {
        const body = req.body || {};
        const courseId = typeof body.courseId === 'string' ? body.courseId : '';
        const lessonId = typeof body.lessonId === 'string' ? body.lessonId : '';
        const lessonsByCourse = {
            computer: ['computer-basics', 'browser-search', 'files-and-folders'],
            design: ['design-hierarchy', 'design-color', 'design-poster'],
            career: ['career-skills', 'career-resume', 'career-interview'],
            internet: ['internet-passwords', 'internet-messages', 'internet-privacy'],
            office: ['office-documents', 'office-tables', 'office-presentations'],
            budget: ['budget-income-expenses', 'budget-planning', 'budget-savings'],
            planning: ['planning-goals', 'planning-time', 'planning-breakdown'],
            communication: ['communication-requests', 'communication-listening', 'communication-teamwork']
        };
        if (!lessonsByCourse[courseId] || !lessonsByCourse[courseId].includes(lessonId)) {
            return res.status(400).json({ error: 'Не удалось определить курс или урок.' });
        }

        const { error } = await req.supabase
            .from('learning_progress')
            .upsert({
                user_id: req.user.id,
                course_id: courseId,
                lesson_id: lessonId
            }, { onConflict: 'user_id,course_id,lesson_id' });

        if (error) return sendSupabaseError(res, error, 'Не удалось сохранить прогресс.');
        res.status(201).json({ saved: true });
    } catch (error) {
        next(error);
    }
});

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Маршрут API не найден.' });
});

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error('[api]', error.message);
    res.status(status).json({
        error: status >= 500 && status !== 503
            ? 'Не удалось выполнить запрос. Попробуйте ещё раз.'
            : error.message
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`EduAI запущен: http://localhost:${PORT}`);
});
