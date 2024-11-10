// 分别存储基础版和高级版的数据
let globalData = {
    basic: {
        collectedUsers: [],
        savedUserList: []
    },
    pro: {
        collectedUsers: [],
        savedUserList: []
    }
};

// 初始化时从 storage 加载两个版本的数据
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const result = await chrome.storage.local.get([
            'collectedUsers', 'savedUserList',
            'proCollectedUsers', 'proSavedUserList'
        ]);
        
        // 加载基础版数据
        if (result.savedUserList) {
            globalData.basic = {
                collectedUsers: result.collectedUsers || [],
                savedUserList: result.savedUserList || []
            };
            console.log('Background: 基础版数据加载完成，用户数:', result.savedUserList.length);
        }
        
        // 加载高级版数据
        if (result.proSavedUserList) {
            globalData.pro = {
                collectedUsers: result.proCollectedUsers || [],
                savedUserList: result.proSavedUserList || []
            };
            console.log('Background: 高级版数据加载完成，用户数:', result.proSavedUserList.length);
        }
    } catch (error) {
        console.error('Background: 加载数据失败:', error);
    }
});

// 监听消息，根据版本处理不同的数据
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const version = request.version || 'basic';
    console.log('Background: 收到请求，版本:', version, '操作:', request.action);

    if (request.action === 'saveData') {
        // 保存数据到内存
        globalData[version] = request.data;
        
        // 根据版本选择存储键名
        const storageData = version === 'pro' ? {
            'proCollectedUsers': request.data.collectedUsers,
            'proSavedUserList': request.data.savedUserList
        } : {
            'collectedUsers': request.data.collectedUsers,
            'savedUserList': request.data.savedUserList
        };
        
        // 保存到 storage
        chrome.storage.local.set(storageData, () => {
            console.log(`Background: ${version}版数据已保存，用户数:`, request.data.savedUserList.length);
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'getSavedData') {
        console.log(`Background: 返回${version}版数据，用户数:`, globalData[version].savedUserList.length);
        sendResponse(globalData[version]);
        return true;
    }

    if (request.action === 'clearData') {
        // 清除指定版本的数据
        globalData[version] = {
            collectedUsers: [],
            savedUserList: []
        };
        
        // 根据版本选择要清除的键
        const keysToRemove = version === 'pro' ? 
            ['proCollectedUsers', 'proSavedUserList'] : 
            ['collectedUsers', 'savedUserList'];
        
        chrome.storage.local.remove(keysToRemove, () => {
            console.log(`Background: ${version}版数据已清除`);
            sendResponse({ success: true });
        });
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
});

// 定期保存数据到 storage
setInterval(() => {
    // 保存基础版数据
    if (globalData.basic.savedUserList.length > 0) {
        chrome.storage.local.set({
            'collectedUsers': globalData.basic.collectedUsers,
            'savedUserList': globalData.basic.savedUserList
        }, () => {
            console.log('Background: 基础版数据自动保存完成，用户数:', globalData.basic.savedUserList.length);
        });
    }
    
    // 保存高级版数据
    if (globalData.pro.savedUserList.length > 0) {
        chrome.storage.local.set({
            'proCollectedUsers': globalData.pro.collectedUsers,
            'proSavedUserList': globalData.pro.savedUserList
        }, () => {
            console.log('Background: 高级版数据自动保存完成，用户数:', globalData.pro.savedUserList.length);
        });
    }
}, 30000);

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.savedUserList) {
            console.log('Background: 基础版数据已更新，用户数:', 
                changes.savedUserList.newValue?.length || 0);
        }
        if (changes.proSavedUserList) {
            console.log('Background: 高级版数据已更新，用户数:', 
                changes.proSavedUserList.newValue?.length || 0);
        }
    }
}); 