import { courses } from './courses.js';
import { getUi, getLocalizedCourse } from './i18n.js';

const courseById = new Map(courses.map((course) => [course.id, course]));
const settingsDialog = document.querySelector('#settings-dialog');
const courseDialog = document.querySelector('#course-dialog');
const authDialog = document.querySelector('#auth-dialog');
const lessonDialog = document.querySelector('#lesson-dialog');
const searchInput = document.querySelector('#course-search');
const filterContainer = document.querySelector('#course-filters');
const courseGrid = document.querySelector('#course-grid');
let filters = [];
let cards = [];
const toast = document.querySelector('#toast');
const authForm = document.querySelector('#auth-form');
const authNote = document.querySelector('#auth-note');
const authSubmit = document.querySelector('#auth-submit');
const authModeSwitch = document.querySelector('#auth-mode-switch');
const authName = document.querySelector('#auth-name');
const authNameField = document.querySelector('#auth-name-field');
const lessonFeedback = document.querySelector('#lesson-feedback');
const lessonListen = document.querySelector('#lesson-listen');
const quizForm = document.querySelector('#lesson-quiz');
const videoPlay = document.querySelector('#video-play');
const sessionKeys = {
  access: 'ryadom-access-token',
  refresh: 'ryadom-refresh-token'
};

let activeFilter = 'all';
let currentCourseId = 'computer';
let currentLessonIndex = 0;
let currentUser = null;
let authAvailable = false;
let authMode = 'login';
let pendingCompletion = null;
let toastTimer;
let videoTimer = null;
let videoScenes = [];
let videoSceneIndex = 0;
let videoPlaying = false;
let progressKeys = new Set();
let session = {
  accessToken: sessionStorage.getItem(sessionKeys.access) || '',
  refreshToken: sessionStorage.getItem(sessionKeys.refresh) || ''
};
let textScale = Number(localStorage.getItem('ryadom-text-scale') || '1');
const contrastEnabled = localStorage.getItem('ryadom-high-contrast') === 'true';
const motionReduced = localStorage.getItem('ryadom-reduce-motion') === 'true';
const spacedText = localStorage.getItem('ryadom-spaced-text') === 'true';
const colorVisionModes = ['normal', 'protanopia', 'deuteranopia', 'tritanopia', 'monochrome'];
let colorVisionMode = localStorage.getItem('ryadom-color-vision') || 'normal';
let currentLanguage = localStorage.getItem('ryadom-language') || 'ru';

function getCourse(courseId) {
  const course = courseById.get(courseId);
  return course ? getLocalizedCourse(course, currentLanguage) : null;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3500);
}

function setText(selector, text) {
  const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (element) element.textContent = text;
}

function applyLanguage() {
  const t = getUi(currentLanguage);
  document.documentElement.lang = currentLanguage === 'kk' ? 'kk' : 'ru';
  document.title = currentLanguage === 'kk'
    ? 'EduAI — ыңғайлы оқу қарқыны'
    : 'EduAI — учёба в удобном темпе';
  document.querySelector('meta[name="description"]').setAttribute('content',
    currentLanguage === 'kk'
      ? 'Қолжетімді оқу платформасы: өзіңізге ыңғайлы қарқынмен оқыңыз.'
      : 'Доступная образовательная платформа: учитесь в удобном темпе и выбирайте подходящий формат.');
  document.querySelector('.skip').textContent = t.skip;
  document.querySelector('.brand').setAttribute('aria-label', t.brandAria);
  document.querySelector('.brand > span:last-child').textContent = 'EduAI';
  document.querySelector('.nav-label').textContent = t.learning;
  const navLabels = ['dashboard', 'courses', 'progress', 'achievements'];
  document.querySelectorAll('.nav-link span').forEach((span, index) => {
    span.textContent = t[navLabels[index]];
  });
  document.querySelector('.support strong').textContent = t.helpTitle;
  document.querySelector('.support p').textContent = t.helpText;
  document.querySelector('.support a').textContent = t.writeUs;
  document.querySelector('.breadcrumb').replaceChildren(
    document.createTextNode(`${t.dashboard} / `),
    ...[]
  );
  const breadcrumb = document.querySelector('.breadcrumb');
  breadcrumb.text = '';
  breadcrumb.textContent = `${t.dashboard} / ${t.overview}`;
  document.querySelector('#open-settings').lastChild.textContent = t.accessibility;
  document.querySelector('#open-auth').setAttribute('aria-label', t.loginAria);
  document.querySelector('#language-label').textContent = t.language;
  document.querySelector('#language-select').setAttribute('aria-label', t.language);
  document.querySelector('.welcome .eyebrow').textContent = t.welcomeEyebrow;
  document.querySelector('.welcome-note').textContent = t.welcomeNote;
  document.querySelector('.date-note').textContent = t.rhythm;
  document.querySelector('.hero-copy .eyebrow').textContent = t.heroEyebrow;
  document.querySelector('.hero h2').textContent = t.heroTitle;
  document.querySelector('.hero-copy > p:not(.eyebrow)').textContent = t.heroText;
  setText('.hero-copy .primary', `${t.findCourse} →`);
  document.querySelector('.stats').setAttribute('aria-label', t.results);
  document.querySelectorAll('.stat-label')[0].textContent = t.lessonsDone;
  document.querySelectorAll('.stat-label')[1].textContent = t.coursesActive;
  document.querySelectorAll('.stat-label')[2].textContent = t.coursesDone;
  document.querySelector('#continue-title').textContent = t.continueTitle;
  document.querySelector('#continue-title').nextElementSibling.textContent = t.continueSubtitle;
  document.querySelector('.section-heading .text-link').firstChild.textContent = `${t.allCourses} `;
  document.querySelector('#courses-title').textContent = t.coursesForYou;
  document.querySelector('#courses-title').parentElement.querySelector('p').textContent = t.coursesSubtitle;
  document.querySelector('#clear-filters').firstChild.textContent = `${t.resetFilters} `;
  document.querySelector('#course-search').placeholder = t.searchPlaceholder;
  document.querySelector('.search .visually-hidden').textContent = t.searchAria;
  document.querySelector('#course-filters').setAttribute('aria-label', t.filterAria);
  setText('#empty-state', t.emptyState);
  document.querySelector('#week-title').textContent = t.rhythmTitle;
  document.querySelector('#week-title').nextElementSibling.textContent = t.rhythmText;
  document.querySelector('.achievement-row strong').textContent = t.noRush;
  document.querySelector('.achievement-row strong').nextElementSibling.textContent = t.noRushText;
  document.querySelector('#achievement-title').textContent = t.achievementsTitle;
  document.querySelector('footer').replaceChildren(
    document.createTextNode(`${t.footer} `),
    Object.assign(document.createElement('span'), { textContent: '♥', ariaHidden: 'true' })
  );
  document.querySelector('#settings-title').textContent = t.settingsTitle;
  document.querySelector('#settings-title').parentElement.querySelector('p').textContent = t.settingsSubtitle;
  document.querySelector('.settings-group h3').textContent = t.textView;
  document.querySelector('#text-size-label').firstChild.textContent = t.textSize;
  document.querySelector('#text-size-label .setting-help').textContent = t.textSizeHelp;
  document.querySelector('#decrease-text').setAttribute('aria-label', t.decreaseText);
  document.querySelector('#increase-text').setAttribute('aria-label', t.increaseText);
  document.querySelectorAll('.settings-group h3')[1].textContent = t.display;
  document.querySelectorAll('.settings-group h3')[2].textContent = t.narration;
  document.querySelector('#auth-dialog [data-close]').setAttribute('aria-label', t.closeAuth);
  setAuthMode(authMode);
  syncAccountUi();
  renderCourseCatalog();
  updateProgressUi();
  updateVoiceOptions();
}

function setAuthNote(message, isError = false) {
  authNote.textContent = message;
  authNote.classList.toggle('error', isError);
}

function setLessonFeedback(message, isError = false) {
  lessonFeedback.textContent = message;
  lessonFeedback.classList.toggle('error', isError);
}

function clearSession() {
  session = { accessToken: '', refreshToken: '' };
  currentUser = null;
  sessionStorage.removeItem(sessionKeys.access);
  sessionStorage.removeItem(sessionKeys.refresh);
  progressKeys = new Set();
}

function saveSession(payload) {
  if (!payload || !payload.access_token || !payload.refresh_token) {
    throw new Error('Сервис не вернул данные сессии. Попробуйте войти ещё раз.');
  }
  session = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token
  };
  sessionStorage.setItem(sessionKeys.access, session.accessToken);
  sessionStorage.setItem(sessionKeys.refresh, session.refreshToken);
}

async function request(path, options = {}, canRefresh = true) {
  const method = options.method || 'GET';
  const authenticated = options.authenticated !== false;
  const headers = {};
  const init = { method, headers };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  if (authenticated && session.accessToken) {
    headers.Authorization = 'Bearer ' + session.accessToken;
  }

  const response = await fetch(path, init);
  const payload = await response.json();

  if (response.status === 401 && authenticated && canRefresh && session.refreshToken) {
    try {
      const refreshed = await request('/api/auth/refresh', {
        method: 'POST',
        authenticated: false,
        body: { refreshToken: session.refreshToken }
      }, false);
      saveSession(refreshed.session);
    } catch (error) {
      clearSession();
      throw error;
    }
    const retryOptions = path === '/api/auth/logout'
      ? { ...options, body: { ...options.body, refreshToken: session.refreshToken } }
      : options;
    return request(path, retryOptions, false);
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Не удалось выполнить запрос.');
  }
  return payload;
}

function setTextScale(value) {
  textScale = Math.min(2, Math.max(.875, value));
  document.documentElement.style.setProperty('--scale', String(textScale));
  document.querySelector('#text-size-value').textContent = Math.round(textScale * 100) + '%';
  localStorage.setItem('ryadom-text-scale', String(textScale));
}

function updateSettings() {
  const contrastToggle = document.querySelector('#contrast-toggle');
  const motionToggle = document.querySelector('#motion-toggle');
  const spacingToggle = document.querySelector('#spacing-toggle');
  const colorVisionSelect = document.querySelector('#color-vision-mode');
  contrastToggle.checked = contrastEnabled;
  motionToggle.checked = motionReduced;
  spacingToggle.checked = spacedText;
  if (!colorVisionModes.includes(colorVisionMode)) colorVisionMode = 'normal';
  colorVisionSelect.value = colorVisionMode;
  document.body.classList.toggle('high-contrast', contrastEnabled);
  document.body.classList.toggle('reduce-motion', motionReduced);
  document.body.classList.toggle('spaced-text', spacedText);
  document.body.dataset.colorVision = colorVisionMode;

  document.querySelector('#decrease-text').addEventListener('click', () => setTextScale(textScale - .125));
  document.querySelector('#increase-text').addEventListener('click', () => setTextScale(textScale + .125));
  colorVisionSelect.addEventListener('change', () => {
    colorVisionMode = colorVisionModes.includes(colorVisionSelect.value) ? colorVisionSelect.value : 'normal';
    document.body.dataset.colorVision = colorVisionMode;
    localStorage.setItem('ryadom-color-vision', colorVisionMode);
  });
  contrastToggle.addEventListener('change', () => {
    document.body.classList.toggle('high-contrast', contrastToggle.checked);
    localStorage.setItem('ryadom-high-contrast', String(contrastToggle.checked));
  });
  motionToggle.addEventListener('change', () => {
    document.body.classList.toggle('reduce-motion', motionToggle.checked);
    localStorage.setItem('ryadom-reduce-motion', String(motionToggle.checked));
  });
  spacingToggle.addEventListener('change', () => {
    document.body.classList.toggle('spaced-text', spacingToggle.checked);
    localStorage.setItem('ryadom-spaced-text', String(spacingToggle.checked));
  });
  document.querySelector('#voice-select').addEventListener('change', (event) => {
    localStorage.setItem('ryadom-speech-voice', event.currentTarget.value);
  });
  setTextScale(textScale);
  updateVoiceOptions();
}

function renderCourseCatalog() {
  const paletteNames = ['green', 'lilac', 'yellow', 'blue'];
  courseGrid.replaceChildren();
  cards = courses.map((course, index) => {
    const localizedCourse = getLocalizedCourse(course, currentLanguage);
    const card = document.createElement('article');
    card.className = 'course-card';
    card.dataset.category = course.filter;
    card.dataset.title = `${localizedCourse.title} ${localizedCourse.category} ${localizedCourse.description} ${localizedCourse.lessons.map((lesson) => lesson.title).join(' ')}`;
    card.dataset.course = course.id;

    const art = document.createElement('div');
    art.className = `course-art art-${paletteNames[index % paletteNames.length]}`;
    art.setAttribute('aria-hidden', 'true');
    art.textContent = '▶';

    const body = document.createElement('div');
    body.className = 'course-body';
    const category = document.createElement('span');
    category.className = 'tag';
    category.textContent = localizedCourse.category;
    const title = document.createElement('h3');
    title.textContent = localizedCourse.title;
    const description = document.createElement('p');
    description.textContent = localizedCourse.description;

    const footer = document.createElement('div');
    footer.className = 'course-footer';
    const meta = document.createElement('span');
    const t = getUi(currentLanguage);
    meta.textContent = `${lessonCountLabel(course.lessons.length)} · ${course.minutes} ${t.minutes}`;
    const openButton = document.createElement('button');
    openButton.className = 'course-open';
    openButton.type = 'button';
    openButton.dataset.course = course.id;
    openButton.textContent = t.aboutCourse;
    footer.append(meta, openButton);

    const progress = document.createElement('p');
    progress.className = 'course-progress';
    progress.setAttribute('aria-live', 'polite');
    body.append(category, title, description, footer, progress);
    card.append(art, body);
    courseGrid.append(card);
    return card;
  });

  const categoryFilters = [...new Map(courses.map((course) => {
    const localizedCourse = getLocalizedCourse(course, currentLanguage);
    return [course.filter, localizedCourse.category];
  })).entries()];
  filterContainer.replaceChildren();
  const allButton = document.createElement('button');
  allButton.className = 'filter';
  allButton.type = 'button';
  allButton.dataset.filter = 'all';
  allButton.setAttribute('aria-pressed', 'true');
  allButton.textContent = getUi(currentLanguage).allCoursesFilter;
  filterContainer.append(allButton);
  categoryFilters.forEach(([filter, label]) => {
    const button = document.createElement('button');
    button.className = 'filter';
    button.type = 'button';
    button.dataset.filter = filter;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = label;
    filterContainer.append(button);
  });
  filters = [...filterContainer.querySelectorAll('.filter')];
}

function updateCourseSearch() {
  const query = searchInput.value.trim().toLocaleLowerCase(currentLanguage === 'kk' ? 'kk' : 'ru');
  let visibleCount = 0;
  cards.forEach((card) => {
    const visible = (activeFilter === 'all' || card.dataset.category === activeFilter)
      && card.dataset.title.toLocaleLowerCase(currentLanguage === 'kk' ? 'kk' : 'ru').includes(query);
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  document.querySelector('#empty-state').hidden = visibleCount > 0;
}

function isLessonComplete(courseId, lessonId) {
  return progressKeys.has(courseId + ':' + lessonId);
}

function courseCompletionCount(course) {
  return course.lessons.filter((lesson) => isLessonComplete(course.id, lesson.id)).length;
}

function lessonCountLabel(count) {
  if (currentLanguage === 'kk') return `${count} сабақ`;
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} уроков`;
  if (last === 1) return `${count} урок`;
  if (last >= 2 && last <= 4) return `${count} урока`;
  return `${count} уроков`;
}

function updateProgressUi() {
  const lessonCount = courses.reduce((sum, course) => sum + courseCompletionCount(course), 0);
  const completedCourses = courses.filter((course) => courseCompletionCount(course) === course.lessons.length).length;
  const activeCourses = courses.filter((course) => {
    const done = courseCompletionCount(course);
    return done > 0 && done < course.lessons.length;
  }).length;

  document.querySelector('#stat-lessons').textContent = String(lessonCount);
  document.querySelector('#stat-active').textContent = String(activeCourses);
  document.querySelector('#stat-completed').textContent = String(completedCourses);

  cards.forEach((card) => {
    const course = getCourse(card.dataset.course);
    if (!course) return;
    const localizedCourse = getLocalizedCourse(course, currentLanguage);
    const t = getUi(currentLanguage);
    card.querySelector('.course-footer > span').textContent =
      `${lessonCountLabel(course.lessons.length)} · ${course.minutes} ${t.minutes}`;
    let progress = card.querySelector('.course-progress');
    if (!progress) {
      progress = document.createElement('p');
      progress.className = 'course-progress';
      progress.setAttribute('aria-live', 'polite');
      card.querySelector('.course-body').append(progress);
    }
    progress.textContent = currentLanguage === 'kk'
      ? `${courseCompletionCount(course)} / ${course.lessons.length} сабақ өтті`
      : `Пройдено ${courseCompletionCount(course)} из ${course.lessons.length} уроков`;
  });

  const inProgress = courses.find((course) => {
    const done = courseCompletionCount(course);
    return done > 0 && done < course.lessons.length;
  });
  const selectedCourse = inProgress || courses.find((course) => courseCompletionCount(course) < course.lessons.length) || courses[0];
  const completed = courseCompletionCount(selectedCourse);
  const lessonIndex = selectedCourse.lessons.findIndex((lesson) => !isLessonComplete(selectedCourse.id, lesson.id));
  const nextLessonIndex = lessonIndex === -1 ? 0 : lessonIndex;
  const percent = Math.round((completed / selectedCourse.lessons.length) * 100);
  const localizedCourse = getLocalizedCourse(selectedCourse, currentLanguage);
  const t = getUi(currentLanguage);

  document.querySelector('#continue-status').textContent = completed === selectedCourse.lessons.length
    ? t.completed
    : completed > 0 ? t.inProgress : t.newCourse;
  document.querySelector('#continue-category').textContent = localizedCourse.category;
  document.querySelector('#continue-total').textContent = lessonCountLabel(selectedCourse.lessons.length);
  document.querySelector('#continue-course-title').textContent = localizedCourse.title;
  document.querySelector('#continue-next-lesson').textContent = completed > 0 && completed < selectedCourse.lessons.length
    ? `${t.nextLesson}: ${localizedCourse.lessons[nextLessonIndex].title}`
    : completed === selectedCourse.lessons.length
      ? t.courseFinished
      : t.startFirst;
  document.querySelector('#continue-progress').setAttribute('aria-valuenow', String(percent));
  document.querySelector('#continue-progress-label').textContent = `${percent}% ${t.percentDone}`;
  document.querySelector('#continue-fill').style.width = `${percent}%`;
  setButtonLabel(document.querySelector('#continue-button'), completed === selectedCourse.lessons.length ? t.repeatLessons : completed ? t.continue : t.startLesson);
  document.querySelector('#continue-button').dataset.courseId = selectedCourse.id;
  document.querySelector('#continue-button').dataset.lessonIndex = String(nextLessonIndex);
  updateAchievements(lessonCount, completedCourses);
}

function updateAchievements(lessonCount, completedCourses) {
  const categoriesStarted = new Set(courses
    .filter((course) => courseCompletionCount(course) > 0)
    .map((course) => course.category)).size;
  const achievements = currentLanguage === 'kk'
    ? [
      { title: 'Алғашқы қадам', description: 'Бірінші сабақты өтіңіз.', unlocked: lessonCount >= 1 },
      { title: 'Ырғаққа кірдік', description: '3 сабақты өтіңіз.', unlocked: lessonCount >= 3 },
      { title: 'Тұрақтылық', description: '10 сабақты өтіңіз.', unlocked: lessonCount >= 10 },
      { title: 'Алғашқы бітіру', description: 'Бір курстың барлық сабағын өтіңіз.', unlocked: completedCourses >= 1 },
      { title: 'Зерттеуші', description: 'Үш түрлі тақырыптағы курстарды бастаңыз.', unlocked: categoriesStarted >= 3 },
      { title: 'Үш сертификат', description: 'Үш курсты аяқтаңыз.', unlocked: completedCourses >= 3 }
    ]
    : [
      { title: 'Первый шаг', description: 'Пройдите первый урок.', unlocked: lessonCount >= 1 },
      { title: 'Вошли в ритм', description: 'Пройдите 3 урока.', unlocked: lessonCount >= 3 },
      { title: 'Постоянство', description: 'Пройдите 10 уроков.', unlocked: lessonCount >= 10 },
      { title: 'Первый выпуск', description: 'Завершите все уроки одного курса.', unlocked: completedCourses >= 1 },
      { title: 'Исследователь', description: 'Начните курсы в трёх разных темах.', unlocked: categoriesStarted >= 3 },
      { title: 'Три сертификата', description: 'Завершите три курса.', unlocked: completedCourses >= 3 }
    ];
  const list = document.querySelector('#achievement-list');
  const earned = achievements.filter((achievement) => achievement.unlocked).length;
  list.replaceChildren();
  achievements.forEach((achievement) => {
    const item = document.createElement('li');
    item.className = `achievement-row${achievement.unlocked ? '' : ' locked'}`;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = achievement.unlocked ? '✓' : '○';
    const text = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = achievement.title;
    const state = document.createElement('span');
    state.className = 'achievement-state';
    state.textContent = achievement.unlocked
      ? (currentLanguage === 'kk' ? 'Алынды' : 'Получено')
      : (currentLanguage === 'kk' ? 'Әлі жабық' : 'Пока закрыто');
    title.append(state);
    const description = document.createElement('span');
    description.textContent = achievement.description;
    text.append(title, description);
    item.append(badge, text);
    list.append(item);
  });
  document.querySelector('#achievement-summary').textContent = currentLanguage === 'kk'
    ? `${achievements.length} жетістіктен ${earned} алынды.`
    : `Получено ${earned} из ${achievements.length} достижений.`;
}

function setButtonLabel(button, label) {
  button.replaceChildren(document.createTextNode(label + ' '));
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  button.append(arrow);
}

function setAuthMode(mode) {
  authMode = mode;
  const t = getUi(currentLanguage);
  const registering = mode === 'register';
  document.querySelector('#auth-title').textContent = registering ? t.authRegisterTitle : t.authLoginTitle;
  document.querySelector('#auth-description').textContent = registering
    ? t.authRegisterDesc
    : t.authLoginDesc;
  authNameField.hidden = !registering;
  authName.required = registering;
  document.querySelector('#auth-password').autocomplete = registering ? 'new-password' : 'current-password';
  setButtonLabel(authSubmit, registering ? t.register : t.login);
  authModeSwitch.textContent = registering ? t.switchToLogin : t.switchToRegister;
  setAuthNote(authAvailable ? '' : 'Регистрация и сохранение включатся после настройки Supabase. См. database/README.md.', !authAvailable);
  authSubmit.disabled = !authAvailable;
}

function syncAccountUi() {
  const t = getUi(currentLanguage);
  const signedIn = Boolean(currentUser);
  document.querySelector('#open-auth').setAttribute(
    'aria-label',
    signedIn ? `Аккаунт: ${currentUser.name}` : t.loginAria
  );
  document.querySelector('#user-label').textContent = signedIn ? currentUser.name : t.login;
  document.querySelector('#user-avatar').textContent = signedIn && currentUser.name
    ? currentUser.name.trim().charAt(0).toLocaleUpperCase('ru')
    : '→';
  document.querySelector('#welcome-title').textContent = signedIn
    ? (currentLanguage === 'kk' ? `Сәлеметсіз бе, ${currentUser.name}!` : `Здравствуйте, ${currentUser.name}!`)
    : t.welcome;
  authForm.hidden = signedIn;
  authModeSwitch.hidden = signedIn;
  document.querySelector('#sign-out').hidden = !signedIn;
  document.querySelector('label[for="auth-name"]').firstChild.textContent = t.name;
  document.querySelector('label[for="auth-email"]').firstChild.textContent = t.email;
  document.querySelector('label[for="auth-password"]').firstChild.textContent = t.password;
  document.querySelector('#sign-out').textContent = t.logout;
  if (signedIn) {
    document.querySelector('#auth-title').textContent = currentUser.name;
    document.querySelector('#auth-description').textContent = currentUser.email || 'Вы вошли в аккаунт.';
    setAuthNote('');
  } else {
    setAuthMode(authMode);
  }
}

function setServiceNotice(message) {
  const notice = document.querySelector('#service-notice');
  notice.textContent = message;
  notice.hidden = !message;
}

async function loadProgress() {
  const response = await request('/api/progress');
  progressKeys = new Set(response.progress.map((record) => `${record.course_id}:${record.lesson_id}`));
  updateProgressUi();
}

function renderCourseDialog(course) {
  const t = getUi(currentLanguage);
  document.querySelector('#course-dialog-title').textContent = course.title;
  document.querySelector('#course-dialog-meta').textContent = `${course.category} · ${lessonCountLabel(course.lessons.length)} · ${course.minutes} ${t.minutes}`;
  document.querySelector('#course-dialog-description').textContent = course.description;
  setButtonLabel(document.querySelector('#enroll-button'), isCourseComplete(course) ? t.repeatLessons : t.startLearning);
  courseDialog.showModal();
}

function isCourseComplete(course) {
  return courseCompletionCount(course) === course.lessons.length;
}

function appendTextSection(container, tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  container.append(element);
  return element;
}

function updateVoiceOptions() {
  const select = document.querySelector('#voice-select');
  if (!('speechSynthesis' in window)) {
    select.disabled = true;
    return;
  }
  select.disabled = false;
  const localePrefix = currentLanguage === 'kk' ? 'kk' : 'ru';
  const voices = window.speechSynthesis.getVoices()
    .filter((voice) => voice.lang.toLocaleLowerCase(localePrefix).startsWith(localePrefix))
    .sort((left, right) => {
      const naturalVoice = (voice) => /natural|online|neural|premium/i.test(voice.name) || !voice.localService;
      return Number(naturalVoice(right)) - Number(naturalVoice(left));
    });
  const savedVoice = localStorage.getItem('ryadom-speech-voice') || '';
  select.replaceChildren();
  const automatic = document.createElement('option');
  automatic.value = '';
  automatic.textContent = 'Автоматический голос';
  select.append(automatic);
  voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.voiceURI;
    option.textContent = `${voice.name}${voice.localService ? '' : ' · онлайн'}`;
    select.append(option);
  });
  const selectedVoice = voices.find((voice) => voice.voiceURI === savedVoice) || voices[0];
  select.value = savedVoice && voices.some((voice) => voice.voiceURI === savedVoice)
    ? savedVoice
    : selectedVoice ? selectedVoice.voiceURI : '';
  if (savedVoice && !voices.some((voice) => voice.voiceURI === savedVoice)) {
    localStorage.removeItem('ryadom-speech-voice');
  }
}

function speakText(text, onEnd, onError) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = currentLanguage === 'kk' ? 'kk-KZ' : 'ru-RU';
  utterance.rate = .93;
  utterance.pitch = 1;
  utterance.volume = 1;
  const selectedVoiceUri = document.querySelector('#voice-select').value;
  utterance.voice = window.speechSynthesis.getVoices()
    .find((voice) => voice.voiceURI === selectedVoiceUri) || null;
  utterance.onend = onEnd;
  utterance.onerror = (event) => {
    if (event.error !== 'canceled' && event.error !== 'interrupted' && onError) onError();
  };
  window.speechSynthesis.speak(utterance);
  return true;
}

function setVideoScene(index) {
  videoSceneIndex = Math.max(0, Math.min(index, videoScenes.length - 1));
  const scene = videoScenes[videoSceneIndex];
  const sceneElement = document.querySelector('.video-scene');
  sceneElement.classList.remove('scene-enter');
  void sceneElement.offsetWidth;
  sceneElement.classList.add('scene-enter');
  document.querySelector('#video-scene-label').textContent = scene.label;
  document.querySelector('#video-scene-text').textContent = scene.text;
  document.querySelector('#video-scene-count').textContent = `Кадр ${videoSceneIndex + 1} из ${videoScenes.length}`;
  const progress = Math.round(((videoSceneIndex + 1) / videoScenes.length) * 100);
  document.querySelector('#video-progress').setAttribute('aria-valuenow', String(progress));
  document.querySelector('#video-progress').setAttribute('aria-valuetext', `Кадр ${videoSceneIndex + 1} из ${videoScenes.length}`);
  document.querySelector('#video-progress-fill').style.width = `${progress}%`;
  document.querySelector('#video-previous').disabled = videoSceneIndex === 0;
  document.querySelector('#video-next').disabled = videoSceneIndex === videoScenes.length - 1;
  updateVideoPlayButton();
}

function updateVideoPlayButton() {
  videoPlay.setAttribute('aria-pressed', String(videoPlaying));
  videoPlay.textContent = videoPlaying
    ? 'Приостановить видеоурок'
    : videoSceneIndex === videoScenes.length - 1
      ? 'Повторить видеоурок'
      : videoSceneIndex > 0 ? 'Продолжить видеоурок' : 'Смотреть видеоурок';
}

function renderVideoLesson(lesson) {
  videoScenes = [
    { label: 'Объяснение темы', text: lesson.explanation || lesson.intro },
    ...lesson.steps.map((step, index) => ({ label: `Шаг ${index + 1}`, text: step })),
    { label: 'Главное', text: lesson.takeaway }
  ];
  videoPlaying = false;
  setVideoScene(0);
}

function moveVideoScene(offset) {
  if (videoTimer) window.clearTimeout(videoTimer);
  videoTimer = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  lessonListen.textContent = 'Слушать текст';
  setVideoScene(videoSceneIndex + offset);
  if (videoPlaying) playVideoScene();
}

function playVideoScene() {
  const scene = videoScenes[videoSceneIndex];
  const advance = () => {
    if (!videoPlaying) return;
    if (videoSceneIndex === videoScenes.length - 1) {
      videoPlaying = false;
      updateVideoPlayButton();
      document.querySelector('#lesson-audio-status').textContent = 'Видео-разбор завершён.';
      return;
    }
    videoTimer = window.setTimeout(() => {
      setVideoScene(videoSceneIndex + 1);
      playVideoScene();
    }, 650);
  };
  const fallback = () => {
    document.querySelector('#lesson-audio-status').textContent = 'Озвучивание недоступно; видео-разбор продолжается по кадрам.';
    videoTimer = window.setTimeout(advance, 5000);
  };
  document.querySelector('#lesson-audio-status').textContent = 'Видео-разбор озвучивается.';
  if (!speakText(scene.text, advance, fallback)) fallback();
}

function stopSpeech() {
  const wasSpeaking = 'speechSynthesis' in window && window.speechSynthesis.speaking;
  if (videoTimer) window.clearTimeout(videoTimer);
  videoTimer = null;
  videoPlaying = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  lessonListen.textContent = 'Слушать текст';
  updateVideoPlayButton();
  document.querySelector('#lesson-audio-status').textContent = wasSpeaking ? 'Озвучивание остановлено.' : '';
}

function renderQuiz(lesson) {
  const fieldset = document.querySelector('#quiz-options');
  const legend = document.querySelector('#quiz-question');
  legend.textContent = lesson.quiz.question;
  fieldset.replaceChildren(legend);
  lesson.quiz.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'quiz-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'answer';
    input.value = String(index);
    const text = document.createElement('span');
    text.textContent = option;
    label.append(input, text);
    fieldset.append(label);
  });
  const feedback = document.querySelector('#quiz-feedback');
  feedback.textContent = '';
  feedback.classList.remove('error', 'success');
}

function renderLesson() {
  const course = getCourse(currentCourseId);
  const lesson = course.lessons[currentLessonIndex];
  const t = getUi(currentLanguage);
  const done = courseCompletionCount(course);
  const percent = Math.round((done / course.lessons.length) * 100);
  stopSpeech();
  setLessonFeedback('');

  document.querySelector('#lesson-course-title').textContent = course.title;
  document.querySelector('#lesson-course-category').textContent = course.category;
  document.querySelector('#lesson-counter').textContent = currentLanguage === 'kk'
    ? `${currentLessonIndex + 1} / ${course.lessons.length} сабақ`
    : `Урок ${currentLessonIndex + 1} из ${course.lessons.length}`;
  document.querySelector('#lesson-progress-text').textContent = `${percent}% ${t.lessonProgress}`;
  document.querySelector('#lesson-progressbar').setAttribute('aria-valuenow', String(percent));
  document.querySelector('#lesson-progress-fill').style.width = `${percent}%`;
  document.querySelector('#lesson-progressbar').setAttribute('aria-valuetext', `${percent}% завершено`);

  const reading = document.querySelector('#lesson-reading');
  reading.replaceChildren();
  appendTextSection(reading, 'h3', lesson.title);
  appendTextSection(reading, 'h4', t.explanation);
  appendTextSection(reading, 'p', lesson.explanation || lesson.intro);
  appendTextSection(reading, 'h4', t.steps);
  const steps = document.createElement('ol');
  lesson.steps.forEach((step) => appendTextSection(steps, 'li', step));
  reading.append(steps);

  const exercise = document.createElement('aside');
  exercise.className = 'lesson-note';
  exercise.setAttribute('aria-labelledby', 'lesson-exercise-title');
  appendTextSection(exercise, 'h4', t.tryIt);
  exercise.firstElementChild.id = 'lesson-exercise-title';
  appendTextSection(exercise, 'p', lesson.practice);
  reading.append(exercise);
  appendTextSection(reading, 'p', `${t.takeaway}: ${lesson.takeaway}`).className = 'lesson-takeaway';
  renderVideoLesson(lesson);
  renderQuiz(lesson);

  document.querySelector('#lesson-previous').disabled = currentLessonIndex === 0;
  document.querySelector('#lesson-next').disabled = currentLessonIndex === course.lessons.length - 1;
  const completeButton = document.querySelector('#lesson-complete');
  const isComplete = isLessonComplete(course.id, lesson.id);
  completeButton.disabled = isComplete;
  completeButton.textContent = isComplete ? t.lessonCompleted : t.completeLesson;
}

function openLesson(courseId, lessonIndex) {
  const course = getCourse(courseId);
  if (!course) return;
  currentCourseId = course.id;
  currentLessonIndex = Math.max(0, Math.min(lessonIndex, course.lessons.length - 1));
  renderLesson();
  lessonDialog.showModal();
}

function openAuthDialog(message = '') {
  if (currentUser) {
    syncAccountUi();
  } else {
    setAuthMode('login');
    if (message) setAuthNote(message, !authAvailable);
  }
  authDialog.showModal();
}

async function completeLesson(courseId, lessonId) {
  if (!currentUser) {
    if (!authAvailable) {
      setLessonFeedback('Чтобы сохранить прогресс, настройте подключение Supabase. Пока можно читать уроки.', true);
      return;
    }
    pendingCompletion = { courseId, lessonId };
    openAuthDialog('Войдите или зарегистрируйтесь, чтобы сохранить этот урок.');
    return;
  }

  const button = document.querySelector('#lesson-complete');
  button.disabled = true;
  setLessonFeedback('Сохраняем прогресс…');
  try {
    await request('/api/progress', {
      method: 'POST',
      body: { courseId, lessonId }
    });
    progressKeys.add(`${courseId}:${lessonId}`);
    updateProgressUi();
    renderLesson();
    setLessonFeedback('Урок сохранён в вашем прогрессе.');
    showToast('Урок завершён. Ваш прогресс сохранён.');
  } catch (error) {
    button.disabled = false;
    setLessonFeedback(error.message, true);
  }
}

async function acceptSession(payload) {
  saveSession(payload.session);
  currentUser = payload.user;
  syncAccountUi();
  try {
    await loadProgress();
  } catch (error) {
    setAuthNote(`Вы вошли, но прогресс не загрузился: ${error.message}`, true);
    setServiceNotice(`Вход выполнен, но прогресс пока недоступен: ${error.message}`);
  }
  updateProgressUi();
  authDialog.close();
  showToast(`Здравствуйте, ${currentUser.name}!`);

  if (pendingCompletion) {
    const requestedCompletion = pendingCompletion;
    pendingCompletion = null;
    await completeLesson(requestedCompletion.courseId, requestedCompletion.lessonId);
  }
}

async function submitAuth(event) {
  event.preventDefault();
  if (!authAvailable) {
    setAuthNote('Настройте Supabase, чтобы включить вход и регистрацию.', true);
    return;
  }

  const formData = new FormData(authForm);
  const body = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || '')
  };
  if (authMode === 'register') body.name = String(formData.get('name') || '').trim();

  authSubmit.disabled = true;
  setAuthNote(authMode === 'register' ? 'Создаём аккаунт…' : 'Проверяем данные…');
  try {
    const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const response = await request(endpoint, { method: 'POST', authenticated: false, body });
    if (!response.session) {
      setAuthNote('Аккаунт создан. Проверьте почту, подтвердите адрес и затем войдите.');
      return;
    }
    await acceptSession(response);
  } catch (error) {
    if (!session.accessToken) {
      syncAccountUi();
      updateProgressUi();
    }
    setAuthNote(error.message, true);
  } finally {
    authSubmit.disabled = !authAvailable;
  }
}

async function signOut() {
  const button = document.querySelector('#sign-out');
  button.disabled = true;
  try {
    await request('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken: session.refreshToken }
    });
    clearSession();
    syncAccountUi();
    updateProgressUi();
    authDialog.close();
    showToast('Вы вышли из аккаунта.');
  } catch (error) {
    if (!session.accessToken) {
      syncAccountUi();
      updateProgressUi();
    }
    setAuthNote(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function updateAuthAvailability() {
  authSubmit.disabled = !authAvailable;
  if (!authAvailable) {
    const message = 'Для регистрации и синхронизации прогресса настройте SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY. См. database/README.md.';
    setServiceNotice(message);
    setAuthNote(message, true);
  } else {
    setServiceNotice('');
    setAuthNote('');
  }
}

async function bootstrap() {
  try {
    const config = await request('/api/config', { authenticated: false });
    authAvailable = config.authAvailable === true;
    updateAuthAvailability();
    syncAccountUi();

    if (session.accessToken) {
      try {
        const account = await request('/api/auth/me');
        currentUser = account.user;
        await loadProgress();
        syncAccountUi();
      } catch (error) {
        clearSession();
        syncAccountUi();
        setServiceNotice(`Не удалось восстановить сессию: ${error.message}`);
      }
    } else {
      updateProgressUi();
    }
  } catch (error) {
    authAvailable = false;
    updateAuthAvailability();
    setServiceNotice(`Не удалось подключиться к серверу: ${error.message}`);
  }
}

document.querySelector('#open-settings').addEventListener('click', () => settingsDialog.showModal());
document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close());
});
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});
lessonDialog.addEventListener('close', stopSpeech);
document.querySelector('#open-auth').addEventListener('click', () => openAuthDialog());
document.querySelector('#auth-mode-switch').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
authForm.addEventListener('submit', submitAuth);
document.querySelector('#sign-out').addEventListener('click', signOut);
filterContainer.addEventListener('click', (event) => {
  const button = event.target.closest('.filter');
  if (!button) return;
  activeFilter = button.dataset.filter;
  filters.forEach((filter) => filter.setAttribute('aria-pressed', String(filter === button)));
  updateCourseSearch();
});
searchInput.addEventListener('input', updateCourseSearch);
document.querySelector('#clear-filters').addEventListener('click', (event) => {
  event.preventDefault();
  activeFilter = 'all';
  searchInput.value = '';
  filters.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === 'all')));
  updateCourseSearch();
  searchInput.focus();
});
courseGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-course]');
  if (!button) return;
  const course = getCourse(button.dataset.course);
  if (course) {
    document.querySelector('#course-dialog-title').dataset.courseId = course.id;
    renderCourseDialog(course);
  }
});
document.querySelector('#enroll-button').addEventListener('click', () => {
  const course = getCourse(document.querySelector('#course-dialog-title').dataset.courseId);
  if (!course) return;
  courseDialog.close();
  const nextIndex = course.lessons.findIndex((lesson) => !isLessonComplete(course.id, lesson.id));
  openLesson(course.id, nextIndex === -1 ? 0 : nextIndex);
});
document.querySelector('#continue-button').addEventListener('click', (event) => {
  const button = event.currentTarget;
  openLesson(button.dataset.courseId, Number(button.dataset.lessonIndex));
});
document.querySelector('#lesson-complete').addEventListener('click', () => {
  const course = getCourse(currentCourseId);
  const lesson = course.lessons[currentLessonIndex];
  completeLesson(course.id, lesson.id);
});
document.querySelector('#lesson-previous').addEventListener('click', () => {
  if (currentLessonIndex > 0) {
    currentLessonIndex -= 1;
    renderLesson();
  }
});
document.querySelector('#lesson-next').addEventListener('click', () => {
  const course = getCourse(currentCourseId);
  if (currentLessonIndex < course.lessons.length - 1) {
    currentLessonIndex += 1;
    renderLesson();
  }
});
quizForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const selectedAnswer = new FormData(quizForm).get('answer');
  const feedback = document.querySelector('#quiz-feedback');
  const t = getUi(currentLanguage);
  feedback.classList.remove('error', 'success');
  if (selectedAnswer === null) {
    feedback.textContent = t.testAnswer;
    feedback.classList.add('error');
    return;
  }
  const lesson = getCourse(currentCourseId).lessons[currentLessonIndex];
  const correct = Number(selectedAnswer) === lesson.quiz.correctIndex;
  feedback.textContent = `${correct ? t.correct : t.notQuite} ${lesson.quiz.explanation}`;
  feedback.classList.add(correct ? 'success' : 'error');
});
videoPlay.addEventListener('click', () => {
  if (videoPlaying) {
    stopSpeech();
    document.querySelector('#lesson-audio-status').textContent = 'Видео-разбор приостановлен.';
    return;
  }
  if (!videoScenes.length) return;
  if (videoSceneIndex === videoScenes.length - 1) setVideoScene(0);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  lessonListen.textContent = 'Слушать текст';
  videoPlaying = true;
  updateVideoPlayButton();
  playVideoScene();
});
document.querySelector('#video-previous').addEventListener('click', () => moveVideoScene(-1));
document.querySelector('#video-next').addEventListener('click', () => moveVideoScene(1));
lessonListen.addEventListener('click', () => {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    document.querySelector('#lesson-audio-status').textContent = 'В этом браузере нет поддержки озвучивания.';
    showToast('Озвучивание недоступно в этом браузере.');
    return;
  }
  if (window.speechSynthesis.speaking) {
    stopSpeech();
    return;
  }

  const course = getCourse(currentCourseId);
  const lesson = course.lessons[currentLessonIndex];
  const text = [
    lesson.title,
    lesson.explanation || lesson.intro,
    ...lesson.steps,
    `Попробуйте сами: ${lesson.practice}`,
    `Главное: ${lesson.takeaway}`
  ].map((part) => part.trim().replace(/[.!?]+\s*$/, '')).join('. ');
  lessonListen.textContent = 'Остановить озвучивание';
  document.querySelector('#lesson-audio-status').textContent = 'Урок озвучивается.';
  const started = speakText(text, () => {
    lessonListen.textContent = 'Слушать текст';
    document.querySelector('#lesson-audio-status').textContent = 'Озвучивание завершено.';
  }, () => {
    lessonListen.textContent = 'Слушать текст';
    document.querySelector('#lesson-audio-status').textContent = 'Не удалось озвучить урок. Прочитайте текст на экране.';
  });
  if (!started) {
    lessonListen.textContent = 'Слушать текст';
    document.querySelector('#lesson-audio-status').textContent = 'В этом браузере нет поддержки озвучивания.';
  }
});
document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach((item) => item.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'page');
  });
});

document.querySelector('#language-select').value = currentLanguage;
document.querySelector('#language-select').addEventListener('change', (event) => {
  currentLanguage = event.currentTarget.value === 'kk' ? 'kk' : 'ru';
  localStorage.setItem('ryadom-language', currentLanguage);
  applyLanguage();
});

updateSettings();
applyLanguage();
bootstrap();
if ('speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', updateVoiceOptions);
}
