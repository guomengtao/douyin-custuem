// 存储数据的变量
let globalData = {
    collectedUsers: [],
    savedUserList: []
};

// 初始化时从 storage 加载数据
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const result = await chrome.storage.local.get(['collectedUsers', 'savedUserList']);
        if (result.savedUserList) {
            globalData = result;
            console.log('Background: 已从storage加载数据，用户数:', result.savedUserList.length);
        }
    } catch (error) {
        console.error('Background: 加载数据失败:', error);
    }
});

// 监听标签页更新和激活
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('douyin.com')) {
        chrome.tabs.sendMessage(tabId, {
            action: 'updateData',
            data: globalData
        }).catch(console.error);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url?.includes('douyin.com')) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'updateData',
                data: globalData
            }).catch(console.error);
        }
    } catch (error) {
        console.error('Background: 标签页切换错误:', error);
    }
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveData') {
        globalData = request.data;
        // 同时保存到 storage
        chrome.storage.local.set(globalData, () => {
            console.log('Background: 数据已保存到storage，用户数:', globalData.savedUserList.length);
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'getSavedData') {
        // 首先尝试从内存中获取数据
        if (globalData.savedUserList.length > 0) {
            sendResponse(globalData);
        } else {
            // 如果内存中没有数据，从 storage 中读取
            chrome.storage.local.get(['collectedUsers', 'savedUserList'], (result) => {
                if (result.savedUserList) {
                    globalData = result;
                }
                sendResponse(globalData);
            });
        }
        return true;
    }

    if (request.action === 'downloadTXT') {
        try {
            chrome.downloads.download({
                url: request.url,
                filename: request.filename,
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('下载错误:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError });
                } else {
                    console.log('下载开始，ID:', downloadId);
                    sendResponse({ success: true, downloadId });
                }
            });
        } catch (error) {
            console.error('下载处理错误:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    if (request.action === 'clearData') {
        globalData = {
            collectedUsers: [],
            savedUserList: []
        };
        chrome.storage.local.remove(['collectedUsers', 'savedUserList'], () => {
            console.log('Background: 数据已清除');
            sendResponse({ success: true });
        });
        return true;
    }
});

// 定期保存数据到 storage
setInterval(() => {
    if (globalData.savedUserList.length > 0) {
        chrome.storage.local.set(globalData, () => {
            console.log('Background: 数据自动保存完成，用户数:', globalData.savedUserList.length);
        });
    }
}, 30000); // 每30秒自动保存一次

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.savedUserList) {
            console.log('Background: storage数据已更新，新用户数:', 
                changes.savedUserList.newValue?.length || 0);
        }
    }
}); 