// 在文件最开头定义版本变量
let currentVersion = 'basic'; // 默认使用基础版

// 正则表达式匹配模式
const patterns = {
    phone: /1[3-9]\d{9}/g,
    wechat: /(?:微信|v|V|wx|WX|weixin|Weixin)[号:]?\s*[：:]?\s*([a-zA-Z0-9_-]{6,20})/,
    name: /(?:姓名|称呼|叫|我是|人|联系人)[：:]\s*([^\n\r,，.。]{2,4})/,
    douyinId: /(?:抖音号|抖音|ID)[：:]\s*([a-zA-Z0-9_-]{2,24})/i
};

let isCollecting = false;
let collectedUsers = new Set();
let savedUserList = [];

// 检查 URL 参数来确定版本
function checkVersion() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('pro')) {
        currentVersion = 'pro';
        console.log('🚀 当前使用高级版');
    } else {
        currentVersion = 'basic';
        console.log('🚀 当前使用基础版');
    }
}

// 在初始化时检查版本
checkVersion();

// 添加 URL 变化监听
let lastUrl = window.location.href;
new MutationObserver(() => {
    const url = window.location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        checkVersion();
    }
}).observe(document, { subtree: true, childList: true });

// 立即加载保存的数据，不等待 DOMContentLoaded
loadSavedData();

// 添加页面可见性变化监听
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        loadSavedData(); // 页面变为可见时重新加载数据
    }
});

// 添加页面重新激活监听
window.addEventListener('focus', () => {
    loadSavedData(); // 窗口获得焦点时重新加载数据
});

// 添加扩展上下文检查函数
function checkExtensionContext() {
    return Boolean(chrome.runtime?.id);
}

// 修改加载数据函数，支持不同版本
async function loadSavedData() {
    try {
        const version = document.location.href.includes('pro=true') ? 'pro' : 'basic';
        console.log(`📂 正在加载${version === 'pro' ? '高级版' : '基础版'}数据...`);

        const response = await chrome.runtime.sendMessage({ 
            action: 'getSavedData',
            version: version
        });
        
        if (response && response.savedUserList) {
            savedUserList = response.savedUserList;
            collectedUsers = new Set(response.collectedUsers);
            console.log(`✅ ${version === 'pro' ? '高级版' : '基础版'}数据加载成功，当前用户数: ${savedUserList.length}`);
            return;
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        savedUserList = [];
        collectedUsers = new Set();
    }
}

// Function to save data
function saveData(key, value) {
    chrome.storage.local.set({ [key]: value }, function() {
        console.log('Data saved:', key, value);
    });
}

// Function to retrieve data
function getData(key, callback) {
    chrome.storage.local.get([key], function(result) {
        console.log('Data retrieved:', key, result[key]);
        callback(result[key]);
    });
}

// 修改自动滚动函数，简化错误处理
async function autoScroll() {
    if (!isCollecting) return;
    
    return new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 100;
        let scrolls = 0;
        let maxScrolls = 100;
        let lastHeight = document.documentElement.scrollHeight;
        let noChangeCount = 0;
        
        const timer = setInterval(() => {
            try {
                if (!isCollecting || scrolls >= maxScrolls || noChangeCount > 5) {
                    clearInterval(timer);
                    resolve();
                    return;
                }

                window.scrollBy(0, distance);
                totalHeight += distance;
                scrolls++;

                // 检查页面高度变化
                const currentHeight = document.documentElement.scrollHeight;
                if (currentHeight === lastHeight) {
                    noChangeCount++;
                } else {
                    noChangeCount = 0;
                    lastHeight = currentHeight;
                }

                // 发送进度更新
                chrome.runtime.sendMessage({
                    action: 'updateProgress',
                    progress: Math.min(Math.round((scrolls / maxScrolls) * 100), 100)
                }).catch(console.error);

            } catch (error) {
                console.error('滚动过程错误:', error);
                clearInterval(timer);
                resolve();
            }
        }, 1500);
    });
}

function extractInfo(text) {
    if (!text) return { phone: '', wechat: '', name: '', douyinId: '' };
    
    const phones = text.match(patterns.phone) || [];
    const wechatMatch = text.match(patterns.wechat);
    const nameMatch = text.match(patterns.name);
    const douyinMatch = text.match(patterns.douyinId);

    return {
        phone: phones[0] || '',
        wechat: wechatMatch ? wechatMatch[1] : '',
        name: nameMatch ? nameMatch[1] : '',
        douyinId: douyinMatch ? douyinMatch[1] : ''
    };
}

// 修改 extractUserInfo 函数来匹配当前页面的用户卡片
function extractUserInfo() {
    const userCards = Array.from(document.querySelectorAll('[class*="card"]')).filter(el => {
        return el.textContent.includes('抖音号') || 
               el.textContent.includes('粉丝') || 
               el.querySelector('a[href*="/user/"]');
    });
    
    console.log(`🔍 ${currentVersion === 'pro' ? '高级版' : '基础版'}找到用户卡片数量: ${userCards.length}`);
    const newUserList = [];
    
    userCards.forEach(async user => {
        try {
            // 更新用户名获取方式
            const usernameElement = user.querySelector('.j5WZzJdp span span span span');
            let username = '';
            if (usernameElement) {
                // 获取文本内容，移除表情图片
                username = Array.from(usernameElement.childNodes)
                    .filter(node => node.nodeType === Node.TEXT_NODE)
                    .map(node => node.textContent.trim())
                    .join('')
                    .trim();
            }

            // 获取抖音号 - 更新获取方式，只获取纯数字
            let douyinId = '';
            const spans = user.querySelectorAll('span');
            for (let i = 0; i < spans.length; i++) {
                if (spans[i].textContent.includes('抖音号:')) {
                    const nextSpan = spans[i].nextElementSibling;
                    if (nextSpan && nextSpan.tagName === 'SPAN') {
                        // 只提取数字部分
                        const numberMatch = nextSpan.textContent.match(/\d+/);
                        if (numberMatch) {
                            douyinId = numberMatch[0];
                            break;
                        }
                    }
                }
            }

            // 获取简介内容
            const bio = user.querySelector('.Kdb5Km3i')?.textContent.trim() || '';
            
            // 从简介中提取联系方式信息
            const extractedInfo = extractInfo(bio);

            // 获取所有文本内容用于提取其他信息
            const allText = user.textContent.trim();
            const fansMatch = allText.match(/(\d+\.?\d*[万]?)(?:\s*粉丝)/);
            const likesMatch = allText.match(/(\d+\.?\d*[万]?)(?:\s*获赞)/);
            
            // 提取用户ID和链接
            const userLink = user.querySelector('a[href*="/user/"]')?.href || 
                           user.closest('a[href*="/user/"]')?.href || '';
            const userId = userLink.split('/user/')[1]?.split('?')[0] || '';

            if (collectedUsers.has(userId)) return;

            // 构建用数据
            const userData = {
                username: username || '未知',
                douyinId: douyinId || '', // 只包含纯数字的抖音号
                bio: bio,
                fans: fansMatch ? fansMatch[1] : '',
                likes: likesMatch ? likesMatch[1] : '',
                userLink,
                phone: extractedInfo.phone || '',
                wechat: extractedInfo.wechat || '',
                name: extractedInfo.name || '',
                verified: user.querySelector('[class*="verify"]')?.textContent.trim() || '',
                companyName: user.querySelector('[class*="company"]')?.textContent.trim() || '',
                userId,
                timestamp: Date.now()
            };

            // 只添加有效的用户数据
            if (userData.username || userData.douyinId || userData.bio || userData.phone || userData.wechat) {
                console.log('找到用户:', userData.username, '抖音号:', userData.douyinId);
                newUserList.push(userData);
                savedUserList.push(userData);
                collectedUsers.add(userId);
                await saveCollectedData();
            }
        } catch (error) {
            console.error('提取用户信息错误:', error);
        }
    });

    console.log(`📝 ${currentVersion === 'pro' ? '高级版' : '基础版'}本次提取用户数: ${newUserList.length}`);
    return newUserList;
}

// 修改消息监听器，支持版本区分
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setVersion') {
        currentVersion = request.version;
        // 更新 URL 参数
        const url = new URL(window.location.href);
        if (currentVersion === 'pro') {
            url.searchParams.set('pro', 'true');
        } else {
            url.searchParams.delete('pro');
        }
        window.history.replaceState({}, '', url);
        
        console.log(`🔄 版本已切换为: ${currentVersion === 'pro' ? '高级版' : '基础版'}`);
        loadSavedData(); // 重新加载对应版本的数据
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'getData') {
        // 直接从 background 获取最新数据
        chrome.runtime.sendMessage({ action: 'getSavedData' }, (response) => {
            if (response && response.savedUserList) {
                savedUserList = response.savedUserList;
                collectedUsers = new Set(response.collectedUsers);
                sendResponse({ users: savedUserList });
            } else {
                // 如果从 background 获取失败，尝试从本地存储获取
                chrome.storage.local.get(['collectedUsers', 'savedUserList'], (result) => {
                    if (result.savedUserList) {
                        savedUserList = result.savedUserList;
                        collectedUsers = new Set(result.collectedUsers);
                    }
                    sendResponse({ users: savedUserList });
                });
            }
        });
        return true; // 保持消息通道开放
    }

    if (request.action === 'collect') {
        const version = request.version || 'basic';
        console.log(`🚀 开始${version === 'pro' ? '高级版' : '基础版'}采集...`);
        isCollecting = true;
        
        (async () => {
            try {
                await loadSavedData();
                const newUsers = extractUserInfo();
                await saveCollectedData();
                console.log(`✅ ${version === 'pro' ? '高级版' : '基础版'}采集完成，本次采集用户数: ${newUsers.length}`);
                sendResponse({ users: savedUserList });
            } catch (error) {
                console.error(`❌ ${version === 'pro' ? '高级版' : '基础版'}采集过程错误:`, error);
                sendResponse({ error: error.message });
            } finally {
                isCollecting = false;
            }
        })();
        
        return true;
    }

    if (request.action === 'stop') {
        isCollecting = false;
        sendResponse({ status: 'stopped' });
    }

    if (request.action === 'exportTXT') {
        const result = exportToTXT(savedUserList); // 使用所有保存的用户数据
        sendResponse({ status: result ? 'success' : 'error' });
        return true;
    }

    if (request.action === 'clearData') {
        collectedUsers.clear();
        savedUserList = [];
        chrome.storage.local.remove(['collectedUsers', 'savedUserList'], () => {
            console.log('数据已清除');
            sendResponse({ status: 'success' });
        });
        return true;
    }

    if (request.action === 'updateData') {
        console.log('收到数据更新:', request.data.savedUserList.length);
        if (request.data.collectedUsers) {
            collectedUsers = new Set(request.data.collectedUsers);
        }
        if (request.data.savedUserList) {
            savedUserList = request.data.savedUserList;
        }
        sendResponse({ success: true });
        return true;
    }
});

// 修改数据保存函数
async function saveCollectedData() {
    if (!checkExtensionContext()) {
        console.error('Extension context invalid during data save');
        return;
    }

    // 获取当前版本
    const version = document.location.href.includes('pro=true') ? 'pro' : 'basic';
    console.log(`💾 正在保存${version === 'pro' ? '高级版' : '基础版'}数据...`);

    try {
        // 构建要保存的数据
        const dataToSave = {
            collectedUsers: Array.from(collectedUsers),
            savedUserList: savedUserList
        };

        // 发送到 background 保存
        await chrome.runtime.sendMessage({
            action: 'saveData',
            data: dataToSave,
            version: version // 明确指定版本
        });

        // 保存成功后输出日志
        console.log(`✅ ${version === 'pro' ? '高级版' : '基础版'}数据保存成功，当前用户数: ${savedUserList.length}`);

        // 获取并输出两个版本的数据统计
        const basicData = await chrome.runtime.sendMessage({ 
            action: 'getSavedData', 
            version: 'basic' 
        });
        const proData = await chrome.runtime.sendMessage({ 
            action: 'getSavedData', 
            version: 'pro' 
        });

        console.log('📊 数据统计:', {
            '基础版': {
                '总用户数': basicData?.savedUserList?.length || 0,
                '手机号用户': basicData?.savedUserList?.filter(u => u.phone)?.length || 0
            },
            '高级版': {
                '总用户数': proData?.savedUserList?.length || 0,
                '手机号用户': proData?.savedUserList?.filter(u => u.phone)?.length || 0
            },
            '当前使用版本': version
        });

        // 如果是高级版，确保数据已经保存到高级版数据库
        if (version === 'pro') {
            // 再次验证数据是否保存成功
            const verifyData = await chrome.runtime.sendMessage({ 
                action: 'getSavedData', 
                version: 'pro' 
            });
            if (!verifyData?.savedUserList?.length) {
                console.error('❌ 高级版数据保存验证失败，尝试重新保存');
                setTimeout(() => saveCollectedData(), 1000);
            }
        }

    } catch (error) {
        console.error('保存数据失败:', error);
        setTimeout(() => saveCollectedData(), 1000);
    }
}

// 修改导出函数为 TXT 格式
function exportToTXT(users) {
    try {
        const formatUser = user => {
            const lines = [
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                `用户名称：${user.username || '未填写'}`,
                `抖音号：${user.douyinId || '未填写'}`
            ];

            if (user.phone) lines.push(`手机号：${user.phone}`);
            if (user.wechat) lines.push(`微信号：${user.wechat}`);
            if (user.companyName) lines.push(`公司名称：${user.companyName}`);
            if (user.verified) lines.push(`认证信息：${user.verified}`);
            
            lines.push(
                `粉丝数：${user.fans || '未知'}`,
                `获赞数：${user.likes || '未知'}`,
                `简介：${user.bio || '未填写'}`,
                `主页：${user.userLink || '未知'}`
            );

            return lines.join('\n');
        };

        const txtContent = users.map(formatUser).join('\n\n');
        const blob = new Blob(['\ufeff' + txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        // 发送消息到background script进行下载
        chrome.runtime.sendMessage({
            action: 'downloadTXT',
            url: url,
            filename: `抖音用户数据_${new Date().toLocaleDateString()}.txt`
        }, (response) => {
            // 清理URL
            URL.revokeObjectURL(url);
            
            if (response && response.success) {
                console.log('导出成功');
                return true;
            } else {
                console.error('导出失败:', response?.error || '未知错误');
                return false;
            }
        });

        return true;
    } catch (error) {
        console.error('TXT导出错误:', error);
        return false;
    }
}

// 添加页面加载完成监听器
window.addEventListener('load', () => {
    console.log('页面加载完成，开始加载数据...');
    loadSavedData();
});

// 添加页面加载和可见性变化监听
document.addEventListener('DOMContentLoaded', () => {
    loadSavedData().catch(console.error);
});

// 当页面变为可见时重新加载数据
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        loadSavedData();
    }
});

// 当标签页被激活时重新加载数据
window.addEventListener('focus', () => {
    loadSavedData();
});

// 定期检查数据更新
setInterval(() => {
    if (document.visibilityState === 'visible') {
        loadSavedData();
    }
}, 5000);

// 添加 jQuery-like contains 选择器
document.querySelectorAll = ((DocumentPrototype) => {
    const originalQSA = DocumentPrototype.querySelectorAll;
    return function(selector) {
        if (selector.includes(':contains(')) {
            const elements = Array.from(originalQSA.call(this, '*'));
            const text = selector.match(/:contains\((.*?)\)/)[1].replace(/['"]/g, '');
            return elements.filter(el => el.textContent.includes(text));
        }
        return originalQSA.call(this, selector);
    };
})(Document.prototype);

// 添加自动重新加载功能
function setupAutoReload() {
    let checkInterval;
    
    function startChecking() {
        checkInterval = setInterval(() => {
            if (!chrome.runtime?.id) {
                console.log('检测到扩展上下文失效，准备重新加载...');
                clearInterval(checkInterval);
                window.location.reload();
            }
        }, 1000);
    }

    function stopChecking() {
        if (checkInterval) {
            clearInterval(checkInterval);
        }
    }

    // 页面可见性变化时启动/停止检查
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            startChecking();
        } else {
            stopChecking();
        }
    });

    // 初始启动检查
    if (document.visibilityState === 'visible') {
        startChecking();
    }
}

// 在页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    setupAutoReload();
    loadSavedData().catch(console.error);
});

// 修改统计信息输出
function outputStats() {
    console.log(`📊 ${currentVersion === 'pro' ? '高级版' : '基础版'}数据统计:`, {
        '总用户数': savedUserList.length,
        '手机号用户数': savedUserList.filter(user => user.phone).length,
        '微信号用户数': savedUserList.filter(user => user.wechat).length
    });
}

// 定期输出统计信息
setInterval(() => {
    if (document.visibilityState === 'visible') {
        outputStats();
    }
}, 5000);