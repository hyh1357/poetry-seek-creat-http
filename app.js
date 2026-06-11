// ==========================================
// 诗词应用 - 古文岛风格四分类版
// 名句 | 诗文 | 古籍 | 作者
// ==========================================

let currentPage = 'mingju';
let editingPoemId = null;
let modalPoem = null;
let isModalReference = false;

// 筛选状态
const filters = {
    mingju: { type: '', author: '', dynasty: '', theme: '' },
    shiwen: { type: '', author: '', dynasty: '', theme: '' }
};

let mingjuSearch = '';
let shiwenSearch = '';
let authorSearch = '';
let _dynamicMingjuList = [];  // 动态生成的名句缓存

// 朝代排序（古文岛顺序）
const DYNASTY_ORDER = ['先秦', '两汉', '魏晋', '南北朝', '隋代', '唐代', '五代', '宋代', '金朝', '元代', '明代', '清代'];

function sortByDynastyOrder(arr, getDynasty) {
    return arr.sort((a, b) => {
        const da = DYNASTY_ORDER.indexOf(getDynasty(a));
        const db = DYNASTY_ORDER.indexOf(getDynasty(b));
        if (da === -1 && db === -1) return 0;
        if (da === -1) return 1;
        if (db === -1) return -1;
        return da - db;
    });
}

// ======================== 初始化 ========================
document.addEventListener('DOMContentLoaded', () => {
    // 先检查站点密码
    checkSitePassword().then(passed => {
        if (passed) {
            initApp();
        }
    });
});

function initApp() {
    initEventListeners();
    renderDailyQuote();
    renderMingju();
    renderShiwen();
    renderGuji('经部');
    renderAuthors();
    renderMyPoems();
    initAgent();  // 初始化创作助手
}

// ======================== 站点密码验证 ========================
function checkSitePassword() {
    const overlay = document.getElementById('site-password-overlay');
    const input = document.getElementById('site-password-input');
    const btn = document.getElementById('site-password-btn');
    const errorEl = document.getElementById('site-password-error');
    
    // 先检查 sessionStorage（关闭标签页即失效）
    if (sessionStorage.getItem('site_verified') === 'true') {
        if (overlay) overlay.style.display = 'none';
        return Promise.resolve(true);
    }
    
    return new Promise((resolve) => {
        // 静态托管（GitHub Pages）下无后端 API，直接通过
        if (overlay) overlay.style.display = 'none';
        resolve(true);
    });
}

// ======================== 事件绑定 ========================
function initEventListeners() {
    // 导航按钮
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });

    // 名句筛选
    document.querySelectorAll('#mingju .filter-toggle').forEach(btn => {
        btn.addEventListener('click', () => toggleFilter('mingju', btn.dataset.filter.replace('mingju-', '')));
    });
    document.querySelectorAll('#shiwen .filter-toggle').forEach(btn => {
        btn.addEventListener('click', () => toggleFilter('shiwen', btn.dataset.filter.replace('shiwen-', '')));
    });

    // 名句筛选选项（事件委托）
    document.getElementById('mingju')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-option')) {
            const key = e.target.dataset.filter.replace('mingju-', '');
            applyMingjuFilter(key, e.target.dataset.value);
        }
    });
    // 诗文筛选选项
    document.getElementById('shiwen')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-option')) {
            const key = e.target.dataset.filter.replace('shiwen-', '');
            applyShiwenFilter(key, e.target.dataset.value);
        }
    });

    // 名句重置
    document.getElementById('mingju-reset')?.addEventListener('click', () => {
        filters.mingju = { type: '', author: '', dynasty: '', theme: '' };
        mingjuSearch = '';
        renderMingju();
    });
    // 诗文重置
    document.getElementById('shiwen-reset')?.addEventListener('click', () => {
        filters.shiwen = { type: '', author: '', dynasty: '', theme: '' };
        shiwenSearch = '';
        renderShiwen();
    });

    // 古籍导航
    document.querySelectorAll('.guji-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.guji-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderGuji(btn.dataset.gujiCat);
        });
    });

    // 全局搜索
    const globalSearchInput = document.getElementById('global-search');
    const globalSearchBtn = document.getElementById('global-search-btn');
    globalSearchBtn?.addEventListener('click', () => doGlobalSearch(globalSearchInput.value.trim()));
    globalSearchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            doGlobalSearch(globalSearchInput.value.trim());
        }
    });
    // 点击外部关闭搜索结果
    document.addEventListener('click', (e) => {
        const results = document.getElementById('global-search-results');
        if (results && !e.target.closest('.global-search-box')) {
            results.classList.remove('show');
        }
    });

    // 添加按钮
    document.getElementById('add-btn')?.addEventListener('click', () => openCreatePage());

    // 表单
    document.getElementById('poem-form')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('cancel-btn')?.addEventListener('click', () => switchPage('my-poems'));

    // 弹窗
    document.getElementById('close-modal')?.addEventListener('click', closeModal);
    document.getElementById('poem-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'poem-modal') closeModal();
    });
    document.getElementById('copy-btn')?.addEventListener('click', copyPoemContent);
    document.getElementById('edit-btn')?.addEventListener('click', editPoem);
    document.getElementById('delete-btn')?.addEventListener('click', deletePoemConfirm);

    // 古籍弹窗
    document.getElementById('close-guji-modal')?.addEventListener('click', closeGujiModal);
    document.getElementById('guji-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'guji-modal') closeGujiModal();
    });
    setupGujiViewClick();

    // 作者弹窗
    document.getElementById('close-author-modal')?.addEventListener('click', () => {
        document.getElementById('author-modal').classList.remove('show');
    });
    document.getElementById('author-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'author-modal') {
            document.getElementById('author-modal').classList.remove('show');
        }
    });

    // 名句详情点击 - 事件委托
    document.getElementById('mingju-list')?.addEventListener('click', (e) => {
        const card = e.target.closest('.mingju-card');
        if (card) {
            const id = card.dataset.id;
            const mj = mingjuList.find(m => m.id === id) || _dynamicMingjuList.find(m => m.id === id);
            if (mj) showMingjuDetail(mj);
        }
    });

    // 古籍条目点击 - 事件委托
    document.getElementById('guji-content')?.addEventListener('click', (e) => {
        const item = e.target.closest('.guji-item');
        if (item) {
            const cat = item.dataset.cat;
            const subcat = item.dataset.subcat;
            const name = item.dataset.name;
            openGujiModal(cat, subcat, name);
        }
    });

    // 作者点击 - 弹窗显示作品
    document.getElementById('authors-list')?.addEventListener('click', (e) => {
        const item = e.target.closest('.author-item');
        if (item) {
            const author = item.dataset.author;
            openAuthorModal(author);
        }
    });
}

// ======================== 跨源搜索 ========================

function doGlobalSearch(query) {
    if (!query || query.length < 1) return;
    const q = query.toLowerCase();
    const results = [];

    // 搜索名句
    for (const mj of mingjuList) {
        if ((mj.quote && mj.quote.toLowerCase().includes(q)) ||
            (mj.author && mj.author.toLowerCase().includes(q)) ||
            (mj.source && mj.source.toLowerCase().includes(q))) {
            results.push({ type: '名句', source: mj.source || '', author: mj.author,
                preview: (mj.quote || '').substring(0, 60),
                open: () => switchPage('mingju')
            });
            if (results.length >= 50) break;
        }
    }

    // 搜索诗文（可点击跳转完整诗词）
    if (results.length < 50) {
        const poems = getAllReferencePoems();
        for (const p of poems) {
            if ((p.title && p.title.toLowerCase().includes(q)) ||
                (p.author && p.author.toLowerCase().includes(q)) ||
                (p.content && p.content.toLowerCase().includes(q))) {
                const firstLine = (p.content || '').split('\n')[0] || '';
                const poemData = p; // 保存引用
                results.push({ type: '诗文', source: p.title || '', author: p.author,
                    preview: firstLine.substring(0, 60),
                    _poem: poemData,
                    open: () => {
                        switchPage('shiwen');
                        // 短暂延迟后弹窗
                        setTimeout(() => openPoemModal(poemData, true), 100);
                    }
                });
                if (results.length >= 50) break;
            }
        }
    }

    // 搜索古籍全文
    if (results.length < 50) {
        for (const cat of ['经部', '史部', '子部', '集部']) {
            const subcats = gujiData[cat];
            if (!subcats) continue;
            for (const subcat of Object.keys(subcats)) {
                for (const book of subcats[subcat]) {
                    const nameMatch = (book.name || '').toLowerCase().includes(q);
                    const authorMatch = (book.author || '').toLowerCase().includes(q);
                    let contentMatch = false;
                    let matchPreview = '';
                    const fulltext = book.fulltext || book.cont || '';
                    if (fulltext.toLowerCase().includes(q)) {
                        contentMatch = true;
                        const idx = fulltext.toLowerCase().indexOf(q);
                        const start = Math.max(0, idx - 20);
                        const end = Math.min(fulltext.length, idx + q.length + 40);
                        matchPreview = (start > 0 ? '...' : '') + fulltext.substring(start, end) + (end < fulltext.length ? '...' : '');
                    }
                    if (nameMatch || authorMatch || contentMatch) {
                        const _cat = cat, _subcat = subcat, _name = book.name;
                        results.push({
                            type: '古籍',
                            source: book.name || '',
                            author: book.author || '',
                            preview: matchPreview || (book.cont || '').substring(0, 60),
                            open: () => {
                                switchPage('guji');
                                openGujiModal(_cat, _subcat, _name);
                            }
                        });
                        if (results.length >= 50) break;
                    }
                }
                if (results.length >= 50) break;
            }
            if (results.length >= 50) break;
        }
    }

    // 搜索作者（独立通道，不受50条限制，单独显示）
    const poetryAuthors = getAllReferencePoems();
    const authorMap = {};
    for (const p of poetryAuthors) {
        if (!authorMap[p.author]) {
            authorMap[p.author] = { count: 0, dynasty: p.dynasty || '' };
        }
        authorMap[p.author].count++;
        if (!authorMap[p.author].dynasty && p.dynasty) {
            authorMap[p.author].dynasty = p.dynasty;
        }
    }
    
    const authorResults = [];
    for (const [author, info] of Object.entries(authorMap)) {
        if (author.toLowerCase().includes(q)) {
            const detail = typeof getAuthorDetail === 'function' ? getAuthorDetail(author) : null;
            const bio = detail ? (detail.bio || '') : '';
            const bioPreview = bio ? bio.substring(0, 80) + (bio.length > 80 ? '...' : '') : '';
            const _author = author;
            authorResults.push({
                type: '作者',
                source: author,
                author: author,
                dynasty: info.dynasty,
                count: info.count,
                bioPreview: bioPreview,
                open: () => {
                    switchPage('authors');
                    setTimeout(() => openAuthorModal(_author), 100);
                }
            });
        }
    }
    // 作者结果按作品数量降序排列
    authorResults.sort((a, b) => b.count - a.count);
    // 最多显示 10 个作者
    const topAuthors = authorResults.slice(0, 10);

    displayGlobalResults(results, query, topAuthors);
}

function displayGlobalResults(results, query, authorResults) {
    const container = document.getElementById('global-search-results');
    if (!container) return;

    const showAuthors = authorResults && authorResults.length > 0;

    if (results.length === 0 && !showAuthors) {
        container.innerHTML = '<div class="gsr-empty">未找到相关结果</div>';
        container.classList.add('show');
        return;
    }

    const counts = {};
    for (const r of results) {
        counts[r.type] = (counts[r.type] || 0) + 1;
    }
    const summary = Object.entries(counts).map(([k, v]) => `${k}(${v})`).join(' · ');

    let html = '';
    
    // 作者区域：单独显示且更突出
    if (showAuthors) {
        html += `<div class="gsr-section">
            <div class="gsr-section-title">作者（${authorResults.length}）</div>`;
        for (const r of authorResults) {
            const info = r.dynasty ? `【${r.dynasty}】` : '';
            const bioHtml = r.bioPreview ? `<div class="gsr-item-preview gsr-author-bio">${r.bioPreview}</div>` : '';
            html += `<div class="gsr-item gsr-author-item" data-idx="${authorResults.indexOf(r)}" data-section="author">
                <div class="gsr-item-type">作者</div>
                <div class="gsr-item-source">${r.source} ${info}</div>
                <div class="gsr-item-author">共 ${r.count} 首作品</div>
                ${bioHtml}
            </div>`;
        }
        html += `</div>`;
    }

    if (results.length > 0) {
        html += `<div class="gsr-section">
            <div class="gsr-section-title">其他结果（${results.length}）</div>
            <div class="gsr-summary">${summary}</div>`;
        for (const r of results) {
            html += `<div class="gsr-item" data-idx="${results.indexOf(r)}" data-section="other">
                <div class="gsr-item-type">${r.type}</div>
                <div class="gsr-item-source">${r.source}</div>
                <div class="gsr-item-author">${r.author}</div>
                ${r.preview ? `<div class="gsr-item-preview">${r.preview}</div>` : ''}
            </div>`;
        }
        html += `</div>`;
    }
    
    container.innerHTML = html;
    container.classList.add('show');

    // 作者结果点击
    if (showAuthors) {
        container.querySelectorAll('.gsr-author-item').forEach(el => {
            el.addEventListener('click', () => {
                container.classList.remove('show');
                const idx = parseInt(el.dataset.idx);
                if (authorResults[idx]) authorResults[idx].open();
            });
        });
    }

    // 其他结果点击
    container.querySelectorAll('.gsr-item[data-section="other"]').forEach(el => {
        el.addEventListener('click', () => {
            container.classList.remove('show');
            const idx = parseInt(el.dataset.idx);
            if (results[idx]) results[idx].open();
        });
    });
}

// ======================== 作者弹窗 ========================
function openAuthorModal(author) {
    const poems = getAllReferencePoems().filter(p => p.author === author);
    if (poems.length === 0) return;
    
    const modal = document.getElementById('author-modal');
    const title = document.getElementById('author-modal-title');
    const bioEl = document.getElementById('author-modal-bio');
    const dividerEl = document.getElementById('author-modal-divider');
    const worksEl = document.getElementById('author-modal-works');
    
    title.textContent = author + '（共 ' + poems.length + ' 首）';
    
    // 获取作者详情数据
    const detail = getAuthorDetail(author);
    
    // 生平
    if (detail && detail.bio) {
        bioEl.textContent = detail.bio;
        bioEl.style.display = 'block';
        if (detail.bio.length > 120) {
            bioEl.classList.add('clamped');
            const expandBtn = document.createElement('button');
            expandBtn.className = 'author-modal-expand-btn';
            expandBtn.textContent = '展开全文';
            expandBtn.addEventListener('click', () => {
                if (bioEl.classList.contains('clamped')) {
                    bioEl.classList.remove('clamped');
                    expandBtn.textContent = '收起';
                } else {
                    bioEl.classList.add('clamped');
                    expandBtn.textContent = '展开全文';
                }
            });
            const oldBtn = bioEl.parentNode.querySelector('.author-modal-expand-btn');
            if (oldBtn) oldBtn.remove();
            bioEl.parentNode.insertBefore(expandBtn, bioEl.nextSibling);
        } else {
            bioEl.classList.remove('clamped');
            const oldBtn = bioEl.parentNode.querySelector('.author-modal-expand-btn');
            if (oldBtn) oldBtn.remove();
        }
    } else {
        bioEl.style.display = 'none';
        const oldBtn = bioEl.parentNode.querySelector('.author-modal-expand-btn');
        if (oldBtn) oldBtn.remove();
    }
    
    // 代表作品（分隔线保持隐藏，除非有代表作品数据）
    dividerEl.style.display = 'none';
    
    // 渲染诗词列表
    let poemsHtml = '';
    const groups = {};
    poems.forEach(p => {
        const d = p.dynasty || '未知';
        if (!groups[d]) groups[d] = [];
        groups[d].push(p);
    });
    const sortedGroups = ['先秦', '两汉', '魏晋', '南北朝', '隋代', '唐代', '五代', '宋代', '金朝', '元代', '明代', '清代', '近代', '未知'];
    sortedGroups.forEach(d => {
        if (!groups[d]) return;
        poemsHtml += `<div class="author-dynasty-section"><div class="author-dynasty-label">${d}</div>`;
        groups[d].forEach(p => {
            poemsHtml += createPoemCard(p, true);
        });
        poemsHtml += `</div>`;
    });
    worksEl.innerHTML = poemsHtml;
    
    // 绑定诗词卡片点击 → 跳转完整诗词
    const allPoems = poems;
    worksEl.querySelectorAll('.author-dynasty-section .poem-card').forEach((card, idx) => {
        if (idx < allPoems.length) {
            card.addEventListener('click', () => openPoemModal(allPoems[idx], true));
        }
    });
    
    modal.classList.add('show');
}

// ======================== 页面切换 ========================
function switchPage(pageName) {
    if (pageName === 'create' && pageName !== currentPage) {
        resetForm();
    }
    currentPage = pageName;

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageName);
    });

    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === pageName);
    });
}

// ======================== 筛选器切换 ========================
function toggleFilter(prefix, filterName) {
    const container = document.getElementById(`${prefix}-${filterName}-filters`);
    const btn = document.querySelector(`#${prefix === 'mingju' ? 'mingju' : 'shiwen'} .filter-toggle[data-filter="${prefix}-${filterName}"]`);
    if (!container || !btn) return;
    container.classList.toggle('expanded');
    btn.textContent = container.classList.contains('expanded') ? '收起' : '展开';
}

// 作者筛选排序：按名字字数(2→3→4) → 评分降序 → 取前100
function sortAuthorsForFilter(authors) {
    return authors
        .map(a => ({name: a, rank: authorRanks[a] || 20}))
        .sort((a, b) => {
            const lenA = a.name.length;
            const lenB = b.name.length;
            if (lenA !== lenB) return lenA - lenB;
            if (a.rank !== b.rank) return b.rank - a.rank;
            return a.name.localeCompare(b.name, 'zh');
        })
        .slice(0, 100)
        .map(a => a.name);
}

// ======================== 名句页 ========================

// 基于日期的种子随机数（确保每日相同，每天不同）
function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = ((h << 5) - h) + seed.charCodeAt(i);
        h |= 0;
    }
    return function() {
        h = (h * 9301 + 49297) % 233280;
        return h / 233280;
    };
}

// Fisher-Yates 洗牌，可传入随机函数
function shuffleArray(arr, randFn) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor((randFn || Math.random)() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// 每日佳句：从千古名句中按日期选出3条
function renderDailyQuote() {
    const today = new Date();
    const dateStr = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    const rand = seededRandom(dateStr);

    document.getElementById('daily-quote-date').textContent =
        today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';

    // 仅从千古名句中选取
    const topQuotes = mingjuList.filter(m => m.level === '千古名句');
    const shuffled = shuffleArray(topQuotes, rand);
    const dailyPicks = shuffled.slice(0, 3);

    const container = document.getElementById('daily-quote-list');
    // 用 data-source 记录每个名句的 source 和 author，方便点击时匹配
    container.innerHTML = dailyPicks.map((m, idx) => `
        <div class="daily-quote-item" data-idx="${idx}" data-source="${(m.source || '').replace(/"/g, '&quot;')}" data-author="${(m.author || '').replace(/"/g, '&quot;')}">
            <div class="quote-text">${shortenQuote(m.quote)}</div>
            <div class="quote-source">—— ${m.author}${m.source ? ' 《' + m.source + '》' : ''}</div>
        </div>
    `).join('');

    // 将 picks 存入全局，供点击事件使用
    window.__dailyPicks = dailyPicks;
}

// 点击每日佳句事件（事件委托，绑定 container）
document.getElementById('daily-quote-list')?.addEventListener('click', function(e) {
    // 向上查找被点击的 .daily-quote-item
    const item = e.target.closest('.daily-quote-item');
    if (!item) return;
    
    const mj = window.__dailyPicks?.[parseInt(item.dataset.idx)];
    if (!mj) return;

    // 从参考诗词库中匹配完整诗词
    const poems = getAllReferencePoems();
    let poem = null;
    if (mj.source) {
        // 优先按标题+作者精确匹配
        poem = poems.find(p => p.title === mj.source && p.author === mj.author);
        // 再按内容匹配
        if (!poem) {
            const short = mj.quote.replace(/[，、。！？\s]/g, '').substring(0, 15);
            poem = poems.find(p => p.author === mj.author && p.content.replace(/[，、。！？\s\n]/g, '').includes(short));
        }
        // 最后只按标题匹配
        if (!poem) {
            poem = poems.find(p => p.title === mj.source);
        }
    }
    if (poem) {
        openPoemModal(poem, true);
    } else {
        showMingjuDetail(mj);
    }
});

// 将长文本截断为真正的短名句（只保留第一个有实际内容的句子）
function shortenQuote(text) {
    if (!text) return '';
    // 按句子结束符分割
    const sentences = text.match(/[^。！？]*[。！？]/g);
    if (sentences && sentences.length > 0) {
        // 找到第一个有实际内容（至少7个汉字）的句子
        let result = '';
        for (const s of sentences) {
            const trimmed = s.trim();
            const charCount = trimmed.replace(/[，、。！？\s：；""''「」『』【】《》（）]/g, '').length;
            if (charCount >= 7) {
                result = trimmed;
                break;
            }
        }
        // 如果没找到足够长的句子，就返回最长的那个
        if (!result) {
            let longest = '';
            let maxLen = 0;
            for (const s of sentences) {
                const t = s.trim();
                if (t.length > maxLen) {
                    maxLen = t.length;
                    longest = t;
                }
            }
            result = longest;
        }
        return result;
    }
    // 没有句子结束符，直接截断
    return text.length > 40 ? text.substring(0, 40) + '…' : text;
}

// 从诗词中动态提取名句（前1-2行作为摘录）
function extractMingjuFromPoem(poem) {
    const lines = (poem.content || '').split('\n').filter(l => l.trim().length > 2);
    let quote = lines.slice(0, 2).join('\n');
    if (!quote && poem.content && poem.content.length > 4) {
        quote = poem.content.substring(0, poem.content.indexOf('。') + 1) || poem.content;
    }
    if (!quote || quote.length < 4) return null;
    
    const firstLine = quote.split('\n')[0];
    let form = poem.type || '古诗';
    if (!form || ['唐诗','宋词','元曲','古诗'].includes(form)) {
        if (firstLine.length <= 7) form = '五言';
        else if (firstLine.length <= 11) form = '七言';
        else form = '长短句';
    }
    
    const rank = authorRanks[poem.author] || 20;
    let level = '名句';
    if (rank >= 95) level = '千古名句';
    else if (rank >= 85) level = '传世名句';
    else if (rank >= 75) level = '经典名句';
    else if (rank >= 60) level = '精选名句';
    
    return {
        id: 'dyn-mj-' + poem.id,
        quote: shortenQuote(quote),
        author: poem.author,
        dynasty: poem.dynasty,
        type: poem.type || '古诗',
        form: form,
        level: level,
        source: poem.title || '',
        rank: rank
    };
}

function renderMingju() {
    // 每次渲染随机打乱，让所有名句都有机会展示
    let list = shuffleArray(mingjuList);

    // 应用筛选
    const f = filters.mingju;
    if (f.type) list = list.filter(m => m.type === f.type);
    if (f.author) list = list.filter(m => m.author === f.author);
    if (f.dynasty) list = list.filter(m => m.dynasty === f.dynasty);
    if (f.theme) list = list.filter(m => {
        // 名句可能有theme字段，也可能没有，此时用诗词原文的theme匹配
        const mjTheme = m.theme || (m.level || '');
        return mjTheme === f.theme;
    });

    // 搜索
    if (mingjuSearch) {
        list = list.filter(m =>
            (m.quote && m.quote.toLowerCase().includes(mingjuSearch)) ||
            (m.author && m.author.toLowerCase().includes(mingjuSearch)) ||
            (m.source && m.source.toLowerCase().includes(mingjuSearch))
        );
    }

    // 如果筛选后无结果，动态从诗词库提取名句
    if (list.length === 0) {
        let poems = getAllReferencePoems();
        // 按作者筛选
        if (f.author) {
            poems = poems.filter(p => p.author === f.author);
        }
        if (f.dynasty) {
            poems = poems.filter(p => p.dynasty === f.dynasty);
        }
        if (f.type) {
            poems = poems.filter(p => p.type === f.type);
        }
        if (mingjuSearch) {
            poems = poems.filter(p =>
                (p.title && p.title.toLowerCase().includes(mingjuSearch)) ||
                (p.author && p.author.toLowerCase().includes(mingjuSearch)) ||
                (p.content && p.content.toLowerCase().includes(mingjuSearch))
            );
        }
        // 从这些诗中提取名句
        const seenQuotes = new Set();
        for (const poem of poems) {
            if (list.length >= 200) break;
            const mj = extractMingjuFromPoem(poem);
            if (mj) {
                const key = mj.author + mj.quote.substring(0, 15);
                if (!seenQuotes.has(key)) {
                    seenQuotes.add(key);
                    list.push(mj);
                }
            }
        }
    }
    _dynamicMingjuList = list.filter(m => m.id && m.id.startsWith('dyn-mj-'));

    // 统计
    document.getElementById('mingju-count').textContent = `共 ${list.length} 条`;

    // 渲染
    const container = document.getElementById('mingju-list');
    container.innerHTML = list.map(m => `
        <div class="mingju-card" data-id="${m.id}">
            <span class="mingju-card-level">${m.level}</span>
            <div class="mingju-card-quote">${shortenQuote(m.quote)}</div>
            <div class="mingju-card-source">
                —— ${m.author}${m.source ? ' 《' + m.source + '》' : ''}
            </div>
            <div class="mingju-card-tags">
                <span class="poem-card-tag">${m.dynasty}</span>
                <span class="poem-card-tag">${m.type}</span>
                <span class="poem-card-tag">${m.form}</span>
            </div>
        </div>
    `).join('');

    // 更新筛选选项
    updateMingjuFilters();
}

function updateMingjuFilters() {
    const all = mingjuList;
    // 获取所有可能的主题（从mingjuList和诗词中）
    const allPoemThemes = [...new Set(getAllReferencePoems().map(p => p.theme))];
    // 作者筛选与诗文页同步
    const allPoemAuthors = [...new Set(getAllReferencePoems().map(p => p.author))];
    const mappings = {
        'mingju-type': [...new Set(all.map(m => m.type))].sort(),
        'mingju-author': sortAuthorsForFilter(allPoemAuthors),
        'mingju-dynasty': [...new Set(all.map(m => m.dynasty))].sort(),
        'mingju-theme': allPoemThemes.filter(Boolean).sort()
    };

    Object.entries(mappings).forEach(([id, items]) => {
        const container = document.getElementById(`${id}-filters`);
        if (!container) return;
        const key = id.replace('mingju-', '');
        const fv = filters.mingju[key];
        container.innerHTML = `<button class="filter-option ${fv === '' ? 'active' : ''}" data-filter="${id}" data-value="">全部</button>`;
        items.forEach(item => {
            container.innerHTML += `<button class="filter-option ${fv === item ? 'active' : ''}" data-filter="${id}" data-value="${item}">${item}</button>`;
        });
    });
}

function applyMingjuFilter(key, value) {
    filters.mingju[key] = value;
    renderMingju();
}

function showMingjuDetail(mj) {
    // 在名句详情弹窗中展示完整诗词
    const poem = referencePoems.find(p => p.title === mj.source && p.author === mj.author) ||
                 referencePoems.find(p => p.author === mj.author && p.content.includes(mj.quote.substring(0, 10)));
    
    if (poem) {
        openPoemModal(poem, true);
    } else {
        // 只展示名句信息
        mj._title = mj.source || '名句';
        modalPoem = mj;
        isModalReference = true;
        document.getElementById('modal-title').textContent = mj._title;
        document.getElementById('modal-author').textContent = `—— ${mj.author} · ${mj.dynasty}`;
        document.getElementById('modal-content').textContent = shortenQuote(mj.quote);
        setTagDisplay('modal-dynasty', mj.dynasty);
        setTagDisplay('modal-type', mj.type);
        setTagDisplay('modal-theme', mj.level);
        setTagDisplay('modal-book', mj.form);
        document.getElementById('modal-image').style.display = 'none';
        document.getElementById('edit-btn').style.display = 'none';
        document.getElementById('delete-btn').style.display = 'none';
        document.getElementById('poem-modal').classList.add('show');
    }
}

// ======================== 诗文页 ========================
function renderShiwen() {
    let poems = getAllReferencePoems();

    const f = filters.shiwen;
    if (f.type) poems = poems.filter(p => p.type === f.type);
    if (f.author) poems = poems.filter(p => p.author === f.author);
    if (f.dynasty) poems = poems.filter(p => p.dynasty === f.dynasty);
    // 主题筛选
    if (f.theme) poems = poems.filter(p => p.theme === f.theme);

    // 搜索
    if (shiwenSearch) {
        poems = poems.filter(p =>
            (p.title && p.title.toLowerCase().includes(shiwenSearch)) ||
            (p.author && p.author.toLowerCase().includes(shiwenSearch)) ||
            (p.content && p.content.toLowerCase().includes(shiwenSearch))
        );
    }

    document.getElementById('shiwen-count').textContent = `共 ${poems.length} 首`;

    const container = document.getElementById('shiwen-list');
    container.innerHTML = poems.map(poem => createPoemCard(poem, true)).join('');

    container.querySelectorAll('.poem-card').forEach((card, index) => {
        card.addEventListener('click', () => openPoemModal(poems[index], true));
    });

    updateShiwenFilters();
}

function updateShiwenFilters() {
    const poems = getAllReferencePoems();
    const mappings = {
        'shiwen-type': [...new Set(poems.map(p => p.type))].sort(),
        'shiwen-author': sortAuthorsForFilter([...new Set(poems.map(p => p.author))]),
        'shiwen-dynasty': [...new Set(poems.map(p => p.dynasty))].sort(),
        'shiwen-theme': [...new Set(poems.map(p => p.theme))].filter(Boolean).sort()
    };

    Object.entries(mappings).forEach(([id, items]) => {
        const container = document.getElementById(`${id}-filters`);
        if (!container) return;
        const key = id.replace('shiwen-', '');
        const fv = filters.shiwen[key];
        container.innerHTML = `<button class="filter-option ${fv === '' ? 'active' : ''}" data-filter="${id}" data-value="">全部</button>`;
        items.forEach(item => {
            container.innerHTML += `<button class="filter-option ${fv === item ? 'active' : ''}" data-filter="${id}" data-value="${item}">${item}</button>`;
        });
    });
}

function applyShiwenFilter(key, value) {
    filters.shiwen[key] = value;
    renderShiwen();
}

// ======================== 古籍页 ========================
function renderGuji(category) {
    const data = gujiData[category];
    if (!data) {
        document.getElementById('guji-content').innerHTML = '<div class="empty-state"><p>暂无数据</p></div>';
        return;
    }

    const q = '';
    let totalCount = 0;
    let totalFiltered = 0;

    const container = document.getElementById('guji-content');
    container.innerHTML = Object.entries(data).map(([subcat, items]) => {
        // 搜索过滤
        let filteredItems = items;
        if (q) {
            filteredItems = items.filter(item => {
                const nameMatch = (item.name || '').toLowerCase().includes(q);
                const authorMatch = (item.author || '').toLowerCase().includes(q);
                const contMatch = (item.cont || item.fulltext || '').toLowerCase().includes(q);
                return nameMatch || authorMatch || contMatch;
            });
        }
        totalCount += items.length;
        totalFiltered += filteredItems.length;
        if (filteredItems.length === 0 && q) return ''; // 隐藏无匹配的子分类

        return `
        <div class="guji-section">
            <div class="guji-section-title">
                <span>${subcat}</span>
                <span class="guji-section-count">${filteredItems.length} 部${q ? ` / ${items.length}` : ''}</span>
            </div>
            <div class="guji-section-items">
                ${filteredItems.map(item => {
                    const hasFulltext = item.isFulltext || item.fulltext || (item.views && item.views.length > 0 && item.views[0].cont);
                    // 高亮匹配
                    let nameDisplay = item.name;
                    if (q && nameDisplay.toLowerCase().includes(q)) {
                        const idx = nameDisplay.toLowerCase().indexOf(q);
                        nameDisplay = nameDisplay.substring(0, idx) + '<mark>' + nameDisplay.substring(idx, idx + q.length) + '</mark>' + nameDisplay.substring(idx + q.length);
                    }
                    return `
                    <div class="guji-item ${hasFulltext ? 'guji-item-has-text' : ''}" 
                         data-cat="${category}" data-subcat="${subcat}" data-name="${item.name}">
                        <div class="guji-item-name">
                            ${nameDisplay}
                            ${hasFulltext ? '<span class="guji-fulltext-badge">全文</span>' : ''}
                        </div>
                        <div class="guji-item-author">${item.author || '佚名'}</div>
                        ${hasFulltext ? '<div class="guji-item-hint">点击阅读</div>' : '<div class="guji-item-hint">点击查看详情</div>'}
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).filter(Boolean).join('');

    // 搜索结果显示
    const countEl = document.getElementById('guji-count');
    if (countEl) countEl.textContent = `共 ${totalFiltered} 部${q ? `（匹配 ${totalFiltered}/${totalCount}）` : ''}`;
}

function openGujiModal(cat, subcat, name) {
    const data = gujiData[cat]?.[subcat];
    if (!data) return;
    const item = data.find(i => i.name === name);
    if (!item) return;

    const hasFulltext = item.isFulltext || item.fulltext || (item.views && item.views.length > 0 && item.views[0].cont);

    document.getElementById('guji-modal-title').textContent = item.name;
    document.getElementById('guji-modal-meta').innerHTML = `
        <span>${cat} · ${subcat}</span>
        ${item.author ? `<span> | ${item.author}</span>` : ''}
        ${item.juCount ? `<span> | ${item.juCount}卷</span>` : ''}
        ${hasFulltext ? `<span class="guji-fulltext-badge">全文</span>` : ''}
    `;

    const contEl = document.getElementById('guji-modal-cont');

    // 有全文的书：展示全部正文
    if (hasFulltext) {
        const contentText = item.fulltext || item.cont || '';
        // 按段分割，保留段落结构
        const paragraphs = contentText.split('\n').filter(p => p.trim());
        contEl.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
    } else {
        // 仅有简介
        contEl.innerHTML = `<p>${item.cont || '暂无内容'}</p>`;
    }

    // 章节列表
    const viewsContainer = document.getElementById('guji-modal-views');
    if (item.views && item.views.length > 0) {
        // 筛选出有内容的章节（爬虫数据）和仅有目录的章节
        const viewItems = item.views.filter(v => v.name);
        viewsContainer.innerHTML = '<h4 style="margin-bottom:12px;color:#3A2A1A;">目录</h4>' +
            viewItems.map((v, i) => {
                const hasContent = v.cont && v.cont.length > 20;
                return `
                <div class="guji-modal-view-item ${hasContent ? 'view-has-text' : ''}" 
                     data-view-index="${i}" ${hasContent ? `data-view-cont="${encodeURIComponent(v.cont)}" data-view-name="${v.name}"` : ''}>
                    <div class="guji-view-name">${v.name}</div>
                    ${v.cont && v.cont.length > 20 
                        ? `<div class="guji-view-cont-preview">${v.cont.substring(0, 80)}...</div>
                           <div class="guji-view-action">阅读此章 →</div>`
                        : ''}
                </div>`;
            }).join('');
        viewsContainer.style.display = 'block';
    } else {
        viewsContainer.style.display = 'none';
    }

    document.getElementById('guji-modal').classList.add('show');
}

// 古籍章节点击事件 - 查看该章内容
function setupGujiViewClick() {
    document.getElementById('guji-modal-views')?.addEventListener('click', (e) => {
        const viewItem = e.target.closest('.guji-modal-view-item');
        if (!viewItem) return;
        const contEncoded = viewItem.dataset.viewCont;
        if (!contEncoded) return;
        const cont = decodeURIComponent(contEncoded);
        const name = viewItem.dataset.viewName || '';
        
        const contEl = document.getElementById('guji-modal-cont');
        const paragraphs = cont.split('\n').filter(p => p.trim());
        contEl.innerHTML = `<h3 style="margin-bottom:16px;color:#3A2A1A;">${name}</h3>` +
            paragraphs.map(p => `<p>${p}</p>`).join('');
        
        // 滚动到顶部
        contEl.scrollTop = 0;
    });
}

function closeGujiModal() {
    document.getElementById('guji-modal').classList.remove('show');
}

// ======================== 作者页 ========================
function renderAuthors() {
    // 获取所有作者及其朝代、评分
    const poems = getAllReferencePoems();
    const authorMap = {};
    
    poems.forEach(p => {
        if (!authorMap[p.author]) {
            authorMap[p.author] = {
                name: p.author,
                dynasty: p.dynasty || '未知',
                rank: authorRanks[p.author] || 20,
                count: 0
            };
        }
        authorMap[p.author].count++;
    });

    let authors = Object.values(authorMap);

    // 搜索
    if (authorSearch) {
        authors = authors.filter(a => a.name.toLowerCase().includes(authorSearch));
    }

    // 按朝代分组
    const groups = {};
    authors.forEach(a => {
        const d = a.dynasty || '其他';
        if (!groups[d]) groups[d] = [];
        groups[d].push(a);
    });

    // 按古文岛朝代排序
    const sortedGroups = sortByDynastyOrder(
        Object.entries(groups),
        ([dynasty]) => dynasty
    );

    const container = document.getElementById('authors-list');
    container.innerHTML = sortedGroups.map(([dynasty, authorList]) => `
        <div class="author-dynasty-group">
            <div class="author-dynasty-title">${dynasty}（${authorList.length} 人）</div>
            <div class="author-dynasty-items">
                ${authorList
                    .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, 'zh'))
                    .map(a => `
                        <div class="author-item" data-author="${a.name}">
                            <div class="author-item-name">${a.name}</div>
                            <div class="author-item-rank">${a.rank >= 75 ? a.rank + '分' : ''}</div>
                        </div>
                    `).join('')}
            </div>
        </div>
    `).join('');
}

// ======================== 通用诗词卡片 ========================
function createPoemCard(poem, isReference) {
    return `
        <div class="poem-card" data-id="${poem.id}">
            <div class="poem-card-header">
                <div>
                    <div class="poem-card-title">${poem.title || '无题'}</div>
                    <div class="poem-card-author">—— ${poem.author || '佚名'}</div>
                </div>
                <span class="poem-card-category">${poem.dynasty || '未知'}</span>
            </div>
            <div class="poem-card-content">${poem.content || ''}</div>
            <div class="poem-card-footer">
                ${poem.type ? `<span class="poem-card-tag">${poem.type}</span>` : ''}
                ${poem.theme ? `<span class="poem-card-tag">${poem.theme}</span>` : ''}
                <span class="poem-card-tag">${isReference ? '参考' : '原创'}</span>
            </div>
        </div>
    `;
}

// ======================== 我的诗集 ========================
function renderMyPoems() {
    const poems = getMyPoems();
    const container = document.getElementById('poems-list');
    const emptyState = document.getElementById('empty-state');
    if (!container || !emptyState) return;

    if (poems.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = poems.map(poem => createPoemCard(poem, false)).join('');

    container.querySelectorAll('.poem-card').forEach((card, index) => {
        card.addEventListener('click', () => openPoemModal(poems[index], false));
    });
}

// ======================== 创作/编辑 ========================
function openCreatePage(poem = null) {
    editingPoemId = poem ? poem.id : null;
    document.getElementById('create-title').textContent = poem ? '编辑作品' : '创作新诗';

    if (poem) {
        document.getElementById('poem-id').value = poem.id;
        document.getElementById('poem-title').value = poem.title;
        document.getElementById('poem-author').value = poem.author;
        document.getElementById('poem-category').value = poem.category;
        document.getElementById('poem-content').value = poem.content;
        document.getElementById('poem-image').value = poem.image || '';
    }

    switchPage('create');
}

function resetForm() {
    editingPoemId = null;
    document.getElementById('poem-form').reset();
    document.getElementById('create-title').textContent = '创作新诗';
}

function handleFormSubmit(e) {
    e.preventDefault();

    const poemData = {
        title: document.getElementById('poem-title').value.trim(),
        author: (document.getElementById('poem-author').value.trim() || '佚名'),
        category: document.getElementById('poem-category').value,
        content: document.getElementById('poem-content').value.trim(),
        image: document.getElementById('poem-image').value.trim() || null
    };

    if (!poemData.title || !poemData.content) {
        alert('请填写标题和内容！');
        return;
    }

    if (editingPoemId) {
        updatePoem(editingPoemId, poemData);
        alert('作品已更新！');
    } else {
        addPoem(poemData);
        alert('作品已保存！');
    }

    renderMyPoems();
    switchPage('my-poems');
}

// ======================== 弹窗 ========================
function openPoemModal(poem, isReference) {
    modalPoem = poem;
    isModalReference = isReference;

    document.getElementById('modal-title').textContent = poem.title || '无题';
    document.getElementById('modal-author').textContent = `—— ${poem.author || '佚名'}${poem.dynasty ? ` · ${poem.dynasty}` : ''}`;
    document.getElementById('modal-content').textContent = poem.content || '';

    setTagDisplay('modal-dynasty', poem.dynasty);
    setTagDisplay('modal-type', poem.type);
    setTagDisplay('modal-theme', poem.theme);
    setTagDisplay('modal-book', poem.book);

    const modalImage = document.getElementById('modal-image');
    if (modalImage) {
        if (poem.image) {
            modalImage.src = poem.image;
            modalImage.style.display = 'block';
        } else {
            modalImage.style.display = 'none';
        }
    }

    document.getElementById('edit-btn').style.display = isReference ? 'none' : 'inline-block';
    document.getElementById('delete-btn').style.display = isReference ? 'none' : 'inline-block';

    // 初始化翻译/鉴赏/背景
    initAnalysisTabs(poem);

    document.getElementById('poem-modal').classList.add('show');
}

// ======================== 诗词翻译/鉴赏/背景 ========================
function initAnalysisTabs(poem) {
    // 绑定 tab 切换
    const tabs = document.querySelectorAll('.analysis-tab');
    const contents = {
        translate: document.getElementById('analysis-translate'),
        appreciate: document.getElementById('analysis-appreciate'),
        background: document.getElementById('analysis-background'),
    };

    // 移除旧监听
    tabs.forEach(t => {
        const clone = t.cloneNode(true);
        t.parentNode.replaceChild(clone, t);
    });

    // 重新获取
    const newTabs = document.querySelectorAll('.analysis-tab');
    newTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            newTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            Object.keys(contents).forEach(k => {
                contents[k].style.display = k === tabName ? 'block' : 'none';
            });
            loadAnalysisContent(poem, tabName);
        });
    });

    // 默认激活翻译
    const defaultTab = document.querySelector('.analysis-tab[data-tab="translate"]');
    if (defaultTab) defaultTab.click();
}

function loadAnalysisContent(poem, tabName) {
    const container = document.getElementById(`analysis-${tabName}`);
    if (!container) return;

    // 从本地数据获取
    const analysis = getPoemAnalysis(poem.id);
    if (!analysis) {
        container.innerHTML = '<div class="analysis-placeholder">暂无数据</div>';
        return;
    }

    const tabMap = {
        translate: analysis.translate || '',
        appreciate: analysis.appreciation || '',
        background: analysis.notes || '',
    };

    const text = tabMap[tabName];
    if (text) {
        container.innerHTML = text.replace(/\n/g, '<br>');
    } else {
        container.innerHTML = '<div class="analysis-placeholder">暂无数据</div>';
    }
}

function setTagDisplay(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value || '';
    el.style.display = value ? 'inline-block' : 'none';
}

function closeModal() {
    document.getElementById('poem-modal').classList.remove('show');
    modalPoem = null;
}

function copyPoemContent() {
    if (!modalPoem) return;
    const copyTitle = modalPoem._title || modalPoem.title || '无题';
    const copyContent = modalPoem.quote || modalPoem.content || '';
    const text = `${copyTitle}\n—— ${modalPoem.author || '佚名'}${modalPoem.dynasty ? ` · ${modalPoem.dynasty}` : ''}\n\n${copyContent}`;
    navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板！');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('已复制到剪贴板！');
    });
}

function editPoem() {
    if (!modalPoem || isModalReference) return;
    closeModal();
    openCreatePage(modalPoem);
}

function deletePoemConfirm() {
    if (!modalPoem || isModalReference) return;
    if (confirm('确定要删除这首作品吗？')) {
        deletePoem(modalPoem.id);
        closeModal();
        renderMyPoems();
        alert('作品已删除！');
    }
}

// ======================== 创作助手 Agent ========================

const agentKnowledge = {
    // 四季主题
    春天: {
        keywords: ['春', '东风', '杨柳', '桃花', '燕子', '春雨', '杏花', '莺', '草色', '春光'],
        sample: '春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。',
        advice: '写春诗宜用明丽意象，东风、杨柳、燕莺入句自生春意。可写初春之嫩寒、仲春之繁盛、暮春之惜别。'
    },
    夏天: {
        keywords: ['夏', '荷花', '蝉', '蜻蜓', '烈日', '绿荫', '莲', '蛙', '梅雨', '荷风'],
        sample: '毕竟西湖六月中，风光不与四时同。\n接天莲叶无穷碧，映日荷花别样红。',
        advice: '夏诗宜取清凉意象——荷、竹、雨、月。烈日蝉鸣写酷热，荷风月影写清趣。'
    },
    秋天: {
        keywords: ['秋', '落叶', '霜', '月', '菊花', '鸿雁', '秋风', '枫叶', '寒', '露'],
        sample: '枯藤老树昏鸦，小桥流水人家。\n古道西风瘦马，夕阳西下，断肠人在天涯。',
        advice: '秋诗多含萧瑟之意，宜用落叶、霜月、孤鸿等意象。也可写秋收、登高、思归之情。'
    },
    冬天: {
        keywords: ['冬', '雪', '寒', '梅', '冰', '炉', '北风', '松', '霜', '岁寒'],
        sample: '千山鸟飞绝，万径人踪灭。\n孤舟蓑笠翁，独钓寒江雪。',
        advice: '冬诗善用对比之法——室外风雪与室内炉火、寒江孤影与远山梅香。宜写雪之清、梅之傲。'
    },
    // 情感主题
    爱情: {
        keywords: ['相思', '明月', '红豆', '梦', '泪', '心', '忆', '愿', '情', '念'],
        sample: '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。',
        advice: '情诗贵在含蓄。借景抒情——月、红豆、梧桐、鸳鸯皆可寄情。少用直白之语，多以物喻情。'
    },
    送别: {
        keywords: ['别', '送', '柳', '酒', '亭', '帆', '远', '行', '客', '孤'],
        sample: '故人西辞黄鹤楼，烟花三月下扬州。\n孤帆远影碧空尽，唯见长江天际流。',
        advice: '送别诗以柳枝、浊酒、长亭为常见意象。可写别时之景、别后之思，贵在真情实感。'
    },
    思乡: {
        keywords: ['乡', '归', '家', '故', '月', '梦', '雁', '客', '远', '望'],
        sample: '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。',
        advice: '思乡诗多借明月、鸿雁、秋风起兴。佳节倍思亲，客居望归途，以他乡之景衬故园之情。'
    },
    // 风格
    边塞: {
        keywords: ['塞', '沙', '马', '弓', '雪', '城', '战', '旗', '胡', '关'],
        sample: '秦时明月汉时关，万里长征人未还。\n但使龙城飞将在，不教胡马度阴山。',
        advice: '边塞诗宜写大漠孤烟、长河落日之壮阔。可写将士之豪情，亦可写征人之苦。'
    },
    山水: {
        keywords: ['山', '水', '云', '松', '泉', '石', '峰', '溪', '林', '涧'],
        sample: '空山新雨后，天气晚来秋。\n明月松间照，清泉石上流。',
        advice: '山水诗贵在写意。不必穷形尽相，重在写出山之幽、水之清、云之逸。五言短句最为上。'
    },
    田园: {
        keywords: ['田', '园', '农', '酒', '村', '桑', '鸡', '犬', '篱', '菊'],
        sample: '结庐在人境，而无车马喧。\n问君何能尔？心远地自偏。\n采菊东篱下，悠然见南山。',
        advice: '田园诗宜平淡自然，写农家生活、四时劳作、田园风光。陶渊明为宗，重在闲适之趣。'
    },
    咏物: {
        keywords: ['咏', '梅', '竹', '石', '菊', '松', '莲', '蜂', '蝉', '雪'],
        sample: '墙角数枝梅，凌寒独自开。\n遥知不是雪，为有暗香来。',
        advice: '咏物诗既要写物之形貌，更要寓人之品格。梅之傲、竹之节、莲之洁，皆可入诗。'
    },
    怀古: {
        keywords: ['古', '今', '昔', '旧', '迹', '史', '陵', '宫', '台', '城'],
        sample: '前不见古人，后不见来者。\n念天地之悠悠，独怆然而涕下。',
        advice: '怀古诗常以古迹为引，写兴亡之感、历史之思。今昔对比是其常用手法。'
    }
};

const agentTemplates = {
    '写春天的诗': { theme: '春天', length: 'short' },
    '写秋天的诗': { theme: '秋天', length: 'short' },
    '写爱情的诗': { theme: '爱情', length: 'short' },
    '写送别的诗': { theme: '送别', length: 'short' },
    '写思乡的诗': { theme: '思乡', length: 'short' },
    '写夏天的诗': { theme: '夏天', length: 'short' },
    '写冬天的诗': { theme: '冬天', length: 'short' },
    '写山水诗': { theme: '山水', length: 'short' },
    '写田园诗': { theme: '田园', length: 'short' },
    '写咏物诗': { theme: '咏物', length: 'short' },
    '写边塞诗': { theme: '边塞', length: 'short' },
    '写怀古诗': { theme: '怀古', length: 'short' }
};

// 模板诗句库
const templateLines = {
    '春天': [
        '东风拂面柳如烟，',
        '桃花流水鳜鱼肥。',
        '莺啼燕语报新年，',
        '草色青青柳色黄。',
        '一树春风千万枝，',
        '春来江水绿如蓝。',
        '沾衣欲湿杏花雨，',
        '吹面不寒杨柳风。',
        '等闲识得东风面，',
        '万紫千红总是春。'
    ],
    '秋天': [
        '秋风萧瑟天气凉，',
        '草木摇落露为霜。',
        '月落乌啼霜满天，',
        '江枫渔火对愁眠。',
        '停车坐爱枫林晚，',
        '霜叶红于二月花。',
        '萧萧梧叶送寒声，',
        '江上秋风动客情。',
        '自古逢秋悲寂寥，',
        '我言秋日胜春朝。'
    ],
    '爱情': [
        '两情若是久长时，',
        '又岂在朝朝暮暮。',
        '衣带渐宽终不悔，',
        '为伊消得人憔悴。',
        '此情可待成追忆，',
        '只是当时已惘然。',
        '身无彩凤双飞翼，',
        '心有灵犀一点通。',
        '愿得一心人，',
        '白首不相离。'
    ],
    '送别': [
        '劝君更尽一杯酒，',
        '西出阳关无故人。',
        '莫愁前路无知己，',
        '天下谁人不识君。',
        '海内存知己，',
        '天涯若比邻。',
        '桃花潭水深千尺，',
        '不及汪伦送我情。',
        '山回路转不见君，',
        '雪上空留马行处。'
    ],
    '思乡': [
        '露从今夜白，',
        '月是故乡明。',
        '独在异乡为异客，',
        '每逢佳节倍思亲。',
        '春风又绿江南岸，',
        '明月何时照我还。',
        '少小离家老大回，',
        '乡音无改鬓毛衰。',
        '家在梦中何日到，',
        '春生江上几人还。'
    ]
};

function initAgent() {
    const sendBtn = document.getElementById('agent-send-btn');
    const input = document.getElementById('agent-input');
    const presets = document.querySelectorAll('.agent-preset-btn');
    const aiSwitch = document.getElementById('agent-ai-switch');

    // AI 开关：打开时如果未配置 API Key 则弹出输入框
    aiSwitch?.addEventListener('change', function() {
        if (this.checked && !agentApiConfigured) {
            showLoginForm();
        }
    });

    sendBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            handleAgentMessage(text);
            input.value = '';
        }
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendBtn.click();
        }
    });

    presets.forEach(btn => {
        btn.addEventListener('click', () => {
            handleAgentMessage(btn.dataset.prompt);
        });
    });
}

// AI 状态
let agentApiConfigured = false;
let sessionApiKey = '';
let agentApiChecking = false;
// 对话历史记录
let conversationHistory = [];
let conversationInitialized = false;

// 初始化或重置对话历史（记录创作表单的上下文）
function initConversation() {
    conversationHistory = [];
    conversationInitialized = false;
}

function addToHistory(role, content) {
    conversationHistory.push({role, content});
}

function buildMessages() {
    // 如果还没有初始化，先添加上下文提示
    if (!conversationInitialized) {
        const currentTitle = document.getElementById('poem-title')?.value || '';
        const currentContent = document.getElementById('poem-content')?.value || '';
        if (currentTitle || currentContent) {
            let ctx = '当前用户创作的作品：\n';
            if (currentTitle) ctx += `标题：${currentTitle}\n`;
            if (currentContent) ctx += `内容：\n${currentContent}\n`;
            conversationHistory.unshift({role: 'user', content: ctx});
        }
        conversationInitialized = true;
    }
    // 限制历史长度（保留最近 20 轮对话）
    if (conversationHistory.length > 40) {
        conversationHistory = conversationHistory.slice(-40);
    }
    return conversationHistory;
}

// 检查 API 状态（无后端依赖，直接判断是否有 API Key）
function checkApiStatus() {
    if (agentApiChecking) return;
    agentApiChecking = true;
    showLoginForm();
    agentApiChecking = false;
}

function showLoginForm() {
    let container = document.getElementById('agent-chat');
    
    // 如果不在 AI 助手页面，先跳转
    if (!container) {
        switchPage('ai-agent');
        container = document.getElementById('agent-chat');
    }
    
    if (!container || container.querySelector('.agent-login-msg')) return;
    
    const div = document.createElement('div');
    div.className = 'agent-msg agent-agent agent-login-msg';
    div.innerHTML = `<div class="agent-msg-bubble">
        <strong>登录 AI 创作助手</strong>
        <p style="font-size:12px;color:#6A5A4A;">输入 DeepSeek API Key 可使用 AI 创作，不输入则使用本地模式</p>
        <div style="margin-bottom:8px;">
            <label style="font-size:11px;color:#6A5A4A;display:block;margin-bottom:2px;">DeepSeek API Key</label>
            <input type="password" id="login-key" placeholder="sk-..." style="width:100%;padding:6px 10px;border:1px solid #DDD5CB;border-radius:6px;font-size:12px;box-sizing:border-box;">
        </div>
        <button id="login-confirm-btn" style="width:100%;padding:8px;background:#8B7355;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">确认</button>
        <p style="font-size:11px;color:#B0A090;margin-top:6px;margin-bottom:0;">留空则使用本地模式，API Key 仅本次会话有效</p>
    </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    setTimeout(() => {
        const btn = document.getElementById('login-confirm-btn');
        const keyInput = document.getElementById('login-key');
        if (btn && keyInput) {
            const doLogin = () => {
                const key = keyInput.value.trim();
                sessionApiKey = key;
                agentApiConfigured = !!key;
                // 登录后重置对话历史，开始全新会话
                initConversation();
                div.querySelector('.agent-msg-bubble').innerHTML = key
                    ? '<p>已登录 AI 模式，现在可以开始创作了！</p>'
                    : '<p>已切换至本地模式</p>';
                setTimeout(() => div.remove(), 1500);
            };
            btn.addEventListener('click', doLogin);
            keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
        }
    }, 100);
}

function handleAgentMessage(userText) {
    // 添加用户消息到界面
    addAgentMessage('user', userText);
    // 添加到历史
    addToHistory('user', userText);

    // 检查 AI 开关
    const aiSwitch = document.getElementById('agent-ai-switch');
    const aiEnabled = aiSwitch && aiSwitch.checked;
    
    if (agentApiConfigured && aiEnabled && sessionApiKey) {
        callAiApi(userText);
    } else {
        callLocalEngine(userText);
    }
}

// 直接在前端调用 DeepSeek API
function callAiApi(userText) {
    const currentContent = document.getElementById('poem-content').value;
    const currentTitle = document.getElementById('poem-title').value;
    
    let systemPrompt = "你是一位精通中国古典诗词的创作助手，名叫「诗友」。与用户进行多轮对话，要记住之前的对话内容，保持上下文连贯。";
    if (currentTitle) {
        systemPrompt += `\n用户正在创作一首题为「${currentTitle}」的作品。`;
    }
    if (currentContent) {
        systemPrompt += `\n用户已写的诗句：\n${currentContent}\n`;
    }
    systemPrompt += "\n请根据用户的需求提供帮助。回复要简洁优美，直接给出诗句或建议。";
    
    // 构建完整对话消息（含历史记录）
    const messages = buildMessages();
    
    // 创建消息容器
    const chatContainer = document.getElementById('agent-chat');
    
    // 创建思考过程容器
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'agent-msg agent-agent';
    thinkingDiv.innerHTML = `<div class="agent-thinking">
        <div class="thinking-header" onclick="this.parentNode.classList.toggle('thinking-collapsed')">
            <span class="thinking-icon"></span>
            <span class="thinking-title">思考过程</span>
            <span class="thinking-toggle">▼</span>
        </div>
        <div class="thinking-body"><span class="thinking-cursor">|</span></div>
    </div>`;
    chatContainer.appendChild(thinkingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // 创建回复容器
    const replyDiv = document.createElement('div');
    replyDiv.className = 'agent-msg agent-agent';
    replyDiv.innerHTML = `<div class="agent-msg-bubble"></div>`;
    chatContainer.appendChild(replyDiv);
    const replyBubble = replyDiv.querySelector('.agent-msg-bubble');
    
    const thinkingBody = thinkingDiv.querySelector('.thinking-body');
    
    fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionApiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-reasoner',
            messages: [
                {role: "system", content: systemPrompt},
                ...messages
            ],
            stream: true
        })
    })
    .then(async response => {
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let hasReasoning = false;
        let hasContent = false;
        
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, {stream: true});
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta || {};
                    
                    if (delta.reasoning_content) {
                        hasReasoning = true;
                        // 移除光标后追加
                        const text = thinkingBody.textContent;
                        if (text.endsWith('|')) {
                            thinkingBody.textContent = text.slice(0, -1);
                        }
                        thinkingBody.textContent += delta.reasoning_content;
                        thinkingBody.innerHTML += '<span class="thinking-cursor">|</span>';
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                    
                    if (delta.content) {
                        hasContent = true;
                        replyBubble.textContent += delta.content;
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                } catch(e) {
                    // parse error skip
                }
            }
        }
        
        // 完成
        const cursor = thinkingBody.querySelector('.thinking-cursor');
        if (cursor) cursor.remove();
        if (!hasReasoning) {
            thinkingDiv.remove();
        } else {
            thinkingDiv.classList.add('thinking-done');
        }
        if (!hasContent) {
            replyDiv.remove();
        }
        
        // 单独设置思考过程的展开/折叠
        thinkingDiv.querySelector('.thinking-header').onclick = function() {
            this.parentNode.classList.toggle('thinking-collapsed');
        };
        
        // 将 AI 回复加入历史
        if (hasContent && replyBubble.textContent.trim()) {
            addToHistory('assistant', replyBubble.textContent.trim());
        }
    })
    .catch(err => {
        thinkingDiv.remove();
        replyDiv.remove();
        addAgentMessage('agent', `${err.message}，切换至本地模式`);
        setTimeout(() => callLocalEngine(userText), 200);
    });
}

// 原有的本地规则引擎
function callLocalEngine(userText) {
    const q = userText.toLowerCase();
    let matchedTheme = '';
    let matchedAction = 'generate';
    
    if (q.includes('润色') || q.includes('修改') || q.includes('改一下')) {
        matchedAction = 'polish';
    } else if (q.includes('评价') || q.includes('点评') || q.includes('赏析') || q.includes('分析')) {
        matchedAction = 'evaluate';
    } else if (q.includes('续写') || q.includes('接') || q.includes('下一句')) {
        matchedAction = 'continue';
    } else if (q.includes('引用') || q.includes('名句') || q.includes('经典')) {
        matchedAction = 'quote';
    } else {
        const themeKeys = Object.keys(agentKnowledge);
        for (const key of themeKeys) {
            if (q.includes(key)) {
                matchedTheme = key;
                break;
            }
            if ((key === '春天') && (q.includes('春') || q.includes('花'))) matchedTheme = '春天';
            if ((key === '爱情') && (q.includes('爱') || q.includes('情') || q.includes('相思'))) matchedTheme = '爱情';
            if ((key === '送别') && (q.includes('别') || q.includes('送') || q.includes('离'))) matchedTheme = '送别';
            if ((key === '思乡') && (q.includes('乡') || q.includes('归') || q.includes('故'))) matchedTheme = '思乡';
        }
        if (!matchedTheme && (q.includes('诗') || q.includes('写'))) {
            const themes = Object.keys(agentKnowledge);
            matchedTheme = themes[Math.floor(Math.random() * themes.length)];
        }
    }

    const currentContent = document.getElementById('poem-content').value;
    
    setTimeout(() => {
        let response = '';
        switch (matchedAction) {
            case 'polish':
                response = generatePolishResponse(currentContent);
                break;
            case 'evaluate':
                response = generateEvaluateResponse(currentContent);
                break;
            case 'continue':
                response = generateContinueResponse(currentContent);
                break;
            case 'quote':
                response = generateQuoteResponse(q);
                break;
            default:
                response = generatePoemResponse(matchedTheme, currentContent, q);
                break;
        }
        addAgentMessage('agent', response);
    }, 300);
}

function generatePoemResponse(theme, currentContent, query) {
    if (!theme || !agentKnowledge[theme]) {
        theme = Object.keys(agentKnowledge)[Math.floor(Math.random() * Object.keys(agentKnowledge).length)];
    }
    const data = agentKnowledge[theme];
    const lines = templateLines[theme] || [];

    let response = `## 关于「${theme}」的创作建议\n\n`;
    response += `**${data.advice}**\n\n`;
    response += `**常用意象：** ${data.keywords.slice(0, 6).join('、')}\n\n`;

    if (currentContent) {
        // 已有内容，提供建议
        response += `### 参考名句\n`;
        const quotes = findRelatedQuotes(theme, 3);
        if (quotes.length > 0) {
            quotes.forEach(q => {
                response += `> ${q.quote}\n> —— ${q.author}${q.source ? '《' + q.source + '》' : ''}\n\n`;
            });
        }
        response += `### 建议\n`;
        response += `你的作品已经有一个好的开头！建议围绕「${theme}」的核心意象展开，`;
        response += `注意押韵和平仄。可以尝试用五言或七言句式保持节奏感。\n\n`;
        response += `试试这样接：\n\`\`\`\n${getPoemSample(theme)}\n\`\`\`\n`;
    } else {
        // 新创作
        response += `### 示例参考\n`;
        response += `古典名篇：\n\`\`\`\n${getPoemSample(theme)}\n\`\`\`\n\n`;

        response += `### 给你的一段灵感\n`;
        // 组合几句诗
        let generated = `${theme}主题诗一首：\n\n`;
        if (lines.length >= 4) {
            const shuffled = [...lines].sort(() => Math.random() - 0.5);
            generated += shuffled.slice(0, 4).join('\n');
            // Add a closing line
            generated += '\n' + (theme === '春天' ? '一年之计在于春。' : 
                                theme === '秋天' ? '万里悲秋常作客。' :
                                theme === '爱情' ? '此恨绵绵无绝期。' : 
                                theme === '送别' ? '天下谁人不识君。' : '人生何处不相逢。');
        }
        response += '```\n' + generated + '\n```\n\n';

        response += `**小贴士：** 参考上面的名篇风格，用「${data.keywords.slice(0, 3).join('、')}」等意象写出你心中的「${theme}」。`;
    }
    return response;
}

function generatePolishResponse(content) {
    if (!content) {
        return `## 润色建议\n\n目前还没有内容可以润色。请在「内容」框中先写一些诗句，我再帮你润色修改。`;
    }
    
    const lines = content.split('\n').filter(l => l.trim());
    let response = `## 润色建议\n\n`;
    response += `我分析了你的作品，给出以下建议：\n\n`;
    
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
            // Check length
            const clean = trimmed.replace(/[，。、！？；：,.\s]/g, '');
            const len = clean.length;
            if (len > 7) {
                response += `${i+1}. 「${trimmed}」— 建议精简，五言或七言更符合传统诗词节奏\n`;
            } else if (len <= 5 && len > 0) {
                response += `${i+1}. 「${trimmed}」— 五言简洁有力，不错\n`;
            } else {
                response += `${i+1}. 「${trimmed}」— 七言工整，保持这个节奏\n`;
            }
        }
    });
    
    response += `\n### 改进示例\n`;
    const sampleLine = lines[0] ? lines[0].trim() : '';
    if (sampleLine) {
        const lastChar = sampleLine.slice(-1);
        if (!'，。、！？；：,.;:'.includes(lastChar)) {
            response += `- 建议句末加标点（，或。）\n`;
        }
    }
    response += `- 注意押韵：偶数句末字宜同韵\n`;
    response += `- 保持字数统一：全诗五言或七言应一致\n`;
    response += `- 意境统一：全诗围绕同一主题展开\n`;
    
    if (content.length > 20) {
        // Find the best matching theme
        for (const [theme, data] of Object.entries(agentKnowledge)) {
            if (data.keywords.some(kw => content.includes(kw))) {
                response += `\n你的作品带有「${theme}」的气息，可以参考上面关于${theme}的建议进一步打磨。`;
                break;
            }
        }
    }
    
    return response;
}

function generateEvaluateResponse(content) {
    if (!content) {
        return `## 点评\n\n还没有作品可以点评。先在「内容」框中写下你的诗作吧！`;
    }
    
    const lines = content.split('\n').filter(l => l.trim());
    const totalChars = content.replace(/[\s，。、！？；：,.;:]/g, '').length;
    let score = 60;
    let comments = [];
    
    // Evaluate length
    if (lines.length >= 4) comments.push('结构完整，有四句以上');
    else comments.push('建议至少写四句');
    
    // Evaluate uniformity
    const lineLengths = lines.map(l => l.replace(/[\s，。、！？；：,.;:]/g, '').length);
    const avgLen = lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length;
    if (lineLengths.every(l => Math.abs(l - avgLen) <= 2)) {
        comments.push('字数工整');
        score += 15;
    } else {
        comments.push('注意保持每句字数一致（五言或七言）');
    }
    
    // Check for theme keywords
    let foundTheme = '';
    for (const [theme, data] of Object.entries(agentKnowledge)) {
        if (data.keywords.some(kw => content.includes(kw))) {
            foundTheme = theme;
            comments.push(`使用了「${theme}」的意象`);
            score += 15;
            break;
        }
    }
    
    if (totalChars > 20) score += 10;
    if (lines.length >= 8) score += 5;
    
    score = Math.min(100, Math.max(40, score));
    
    let response = `## 作品点评\n\n`;
    response += `**总体评分：${score}/100**\n\n`;
    response += `**分析：**\n`;
    comments.forEach(c => response += `- ${c}\n`);
    response += `\n**建议：**\n`;
    response += `- 全诗共 ${totalChars} 字，${lines.length} 句\n`;
    response += `- 建议偶数句押韵（末字同韵母）\n`;
    if (foundTheme) {
        response += `- 「${foundTheme}」主题可以参考上面关于${foundTheme}的建议\n`;
    }
    response += `- 好诗不厌百回改，多读多写自然进步！\n`;
    
    return response;
}

function generateContinueResponse(content) {
    if (!content) {
        return `## 续写建议\n\n请先在「内容」框中写一些诗句开头，我来帮你续下去！`;
    }
    
    const lastLine = content.split('\n').filter(l => l.trim()).pop() || '';
    const trimmed = lastLine.replace(/[，。、！？；：,.;:]/g, '').trim();
    
    let response = `## 续写建议\n\n`;
    response += `你的上一句：「${trimmed}」\n\n`;
    
    // Find matching continuation
    const lastChar = trimmed.slice(-1) || '';
    let continuations = [];
    
    for (const [, data] of Object.entries(agentKnowledge)) {
        if (data.keywords.some(kw => content.includes(kw) || lastLine.includes(kw))) {
            continuations = [...continuations, ...data.keywords.slice(0, 3)];
        }
    }
    
    if (continuations.length > 0) {
        response += `可以围绕「${continuations.join('、')}」等意象继续展开：\n\n`;
        response += '```\n';
        // Generate a suggested continuation
        const sug1 = trimmed + '，' + (['不堪回首月明中。', '此情可待成追忆。', '白云千载空悠悠。'][Math.floor(Math.random() * 3)]);
        const sug2 = '欲写' + (continuations[0] || '深情') + '先有泪，' + '心中' + (continuations[1] || '无尽') + '自成诗。';
        response += sug1 + '\n' + sug2 + '\n';
        response += '```\n\n';
        response += `试着保持与前文相同的字数和押韵方式。`;
    } else {
        response += `建议选择「春天」「秋天」「爱情」等主题，围绕主题意象续写。`;
    }
    
    return response;
}

function generateQuoteResponse(query) {
    let matched = [];
    const q = query.toLowerCase();
    
    // Search mingjuList
    for (const mj of mingjuList) {
        const quote = (mj.quote || '').toLowerCase();
        const source = (mj.source || '').toLowerCase();
        if (quote.includes(q) || source.includes(q)) {
            matched.push(mj);
            if (matched.length >= 5) break;
        }
    }
    
    // If no match, get random ones by theme
    if (matched.length === 0) {
        for (const [theme, data] of Object.entries(agentKnowledge)) {
            if (q.includes(theme) || q.includes(theme.slice(0, 1))) {
                const quotes = findRelatedQuotes(theme, 5);
                matched = quotes;
                break;
            }
        }
    }
    
    // Fallback: get recent ones
    if (matched.length === 0) {
        matched = mingjuList.slice(0, 3);
    }
    
    let response = `## 经典名句\n\n`;
    matched.forEach(mj => {
        response += `> ${shortenQuote(mj.quote)}\n> —— ${mj.author}${mj.source ? '《' + mj.source + '》' : ''}\n\n`;
    });
    response += `点击搜索栏可以直接搜索更多名句。`;
    
    return response;
}

function addAgentMessage(type, text) {
    const chat = document.getElementById('agent-chat');
    if (!chat) return;
    
    // Convert markdown-like syntax
    let formatted = text
        .replace(/### /g, '<strong>')
        .replace(/\n\n/g, '</strong><br><br>')
        .replace(/## /g, '<strong>')
        .replace(/\n/g, '<br>')
        .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
        .replace(/> (.*?)(<br>|$)/g, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    const div = document.createElement('div');
    div.className = 'agent-msg agent-' + type;
    div.innerHTML = `<div class="agent-msg-bubble">${formatted}</div>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}
