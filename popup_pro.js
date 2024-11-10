// 在文件开头添加版本标识
const VERSION = 'pro';

// 添加筛选和排序相关变量
let currentUsers = [];
let filteredUsers = [];
let currentFilters = {
    username: '',
    douyinId: '',
    phone: '',
    wechat: ''
};

// 修改数据加载函数
async function loadDataFromBackground() {
    try {
        // 先获取当前标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            // 设置为高级版
            await chrome.tabs.sendMessage(tab.id, { 
                action: 'setVersion',
                version: 'pro'
            });
        }

        // 获取高级版数据
        const response = await chrome.runtime.sendMessage({ 
            action: 'getSavedData',
            version: 'pro'
        });
        
        console.log('高级版数据加载结果:', response);
        
        if (response && response.savedUserList) {
            currentUsers = response.savedUserList;
            filteredUsers = [...currentUsers];
            
            // 立即更新显示
            updateStats(currentUsers, false);
            
            console.log('高级版数据加载成功，用户数:', currentUsers.length);
            return currentUsers;
        } else {
            console.log('未找到高级版数据，初始化空数据');
            currentUsers = [];
            filteredUsers = [];
            updateStats([], false);
            return [];
        }
    } catch (error) {
        console.error('从 background 加载数据失败:', error);
        currentUsers = [];
        filteredUsers = [];
        updateStats([], false);
        return [];
    }
}

// 修改初始化逻辑
document.addEventListener('DOMContentLoaded', async () => {
    console.log('高级版 popup 初始化');
    
    // 立即加载数据
    await loadDataFromBackground();
    
    // 添加事件监听器
    document.getElementById('startCollect').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { 
                action: 'collect',
                version: 'pro'
            }, async response => {
                if (response && response.users) {
                    console.log('采集到新数据，用户数:', response.users.length);
                    // 重新加载数据以更新显示
                    await loadDataFromBackground();
                }
            });
        }
    });

    // 添加筛选和排序事件监听
    document.getElementById('applyFilter').addEventListener('click', () => {
        currentFilters = {
            username: document.getElementById('filterUsername').value,
            douyinId: document.getElementById('filterDouyinId').value,
            phone: document.getElementById('filterPhone').value,
            wechat: document.getElementById('filterWechat').value
        };
        applyFiltersAndSort();
    });

    // 添加排序变化监听
    document.getElementById('sortField').addEventListener('change', applyFiltersAndSort);
    document.getElementById('sortOrder').addEventListener('change', applyFiltersAndSort);
    document.getElementById('phoneFilter').addEventListener('change', applyFiltersAndSort);
});

// 修改更新统计信息函数
function updateStats(users, filtered = false) {
    const displayUsers = filtered ? filteredUsers : users;
    console.log('更新统计信息:', {
        total: users.length,
        display: displayUsers.length,
        filtered: filtered
    });
    
    // 更新统计数字
    document.getElementById('totalUsers').textContent = users.length;
    const phoneUsers = users.filter(user => user.phone).length;
    document.getElementById('phoneUsers').textContent = phoneUsers;
    document.getElementById('displayUsers').textContent = displayUsers.length;
    
    // 更新用户列表显示
    const userList = document.getElementById('userList');
    if (!userList) {
        console.error('找不到用户列表元素');
        return;
    }

    userList.innerHTML = displayUsers.map((user, index) => `
        <div class="user-item">
            <div><strong>序号：</strong>${displayUsers.length - index}</div>
            <div><strong>用户名：</strong>${user.username || '未知'}</div>
            <div><strong>抖音号：</strong>${user.douyinId || '未填写'}</div>
            <div><strong>公司名称：</strong>${user.companyName || '未填写'}</div>
            <div><strong>联系人：</strong>${user.name || '未填写'}</div>
            ${user.phone ? `
                <div class="phone-number">
                    <strong>手机号：</strong>
                    <span>${user.phone}</span>
                    <button class="copy-btn" data-phone="${user.phone}">复制</button>
                </div>
            ` : ''}
            ${user.wechat ? `<div><strong>微信号：</strong>${user.wechat}</div>` : ''}
            <div><strong>简介：</strong>${user.bio || '未填写'}</div>
            <div><strong>采集时间：</strong>${new Date(user.timestamp).toLocaleString()}</div>
        </div>
    `).join('');

    // 添加复制按钮事件监听
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const phone = this.dataset.phone;
            navigator.clipboard.writeText(phone).then(() => {
                const originalText = this.textContent;
                this.textContent = '已复制';
                this.style.background = '#52c41a';
                setTimeout(() => {
                    this.textContent = originalText;
                    this.style.background = '';
                }, 1000);
            });
        });
    });
}

// 添加自动刷新机制
let autoRefreshInterval = setInterval(async () => {
    if (document.visibilityState === 'visible') {
        await loadDataFromBackground();
    }
}, 2000);

// 清理定时器
window.addEventListener('unload', () => {
    clearInterval(autoRefreshInterval);
});

// 定期刷新数据
setInterval(async () => {
    if (document.visibilityState === 'visible') {
        console.log('定期刷新高级版数据');
        await loadDataFromBackground();
    }
}, 2000);

// 添加按钮事件监听器
document.getElementById('stopCollect').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'stop' });
    }
});

// 添加 CSV 导出功能
async function exportToCSV(users) {
    const includeHeaders = document.getElementById('includeHeaders').checked;
    const includeTimestamp = document.getElementById('includeTimestamp').checked;
    const exportFiltered = document.getElementById('exportFiltered').checked;
    
    const usersToExport = exportFiltered ? filteredUsers : users;
    
    let csvContent = '\ufeff'; // 添加 BOM 以支持中文
    
    if (includeHeaders) {
        const headers = [
            '序号', '用户名', '抖音号', '公司名称', '联系人',
            '手机号', '微信号', '粉丝数', '获赞数', '简介', '主页'
        ];
        if (includeTimestamp) headers.push('采集时间');
        csvContent += headers.join(',') + '\n';
    }
    
    csvContent += usersToExport.map((user, index) => {
        const fields = [
            usersToExport.length - index,
            `"${user.username || ''}"`,
            `"${user.douyinId || ''}"`,
            `"${user.companyName || ''}"`,
            `"${user.name || ''}"`,
            `"${user.phone || ''}"`,
            `"${user.wechat || ''}"`,
            `"${user.fans || ''}"`,
            `"${user.likes || ''}"`,
            `"${(user.bio || '').replace(/"/g, '""')}"`,
            `"${user.userLink || ''}"`
        ];
        
        if (includeTimestamp) {
            fields.push(`"${new Date(user.timestamp).toLocaleString()}"`);
        }
        
        return fields.join(',');
    }).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    try {
        await chrome.runtime.sendMessage({
            action: 'downloadTXT',
            url: url,
            filename: `抖音用户数据_${new Date().toLocaleDateString()}.csv`
        });
        console.log('CSV导出成功');
    } catch (error) {
        console.error('CSV导出失败:', error);
    } finally {
        URL.revokeObjectURL(url);
    }
}

// 修改导出按钮事件
document.getElementById('exportCSV').addEventListener('click', async () => {
    const users = await loadDataFromBackground();
    if (users && users.length > 0) {
        await exportToCSV(users);
    }
});

document.getElementById('exportPhone').addEventListener('click', async () => {
    const users = await loadDataFromBackground();
    if (users && users.length > 0) {
        const phoneUsers = users.filter(user => user.phone);
        await exportToCSV(phoneUsers);
    }
});

// 修改清除数据按钮事件
document.getElementById('clearData').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ 
        action: 'clearData',
        version: 'pro'  // 强制指定为高级版
    });
    currentUsers = [];
    filteredUsers = [];
    updateStats([], false);
});

// 版本切换功能
document.getElementById('switchToBasic').addEventListener('click', () => {
    chrome.action.setPopup({ popup: 'popup.html' });
    window.location.href = 'popup.html';
});

// 监听进度更新
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateProgress') {
        document.getElementById('progress').style.width = `${request.progress}%`;
    }
});

// 监听 popup 显示事件
window.addEventListener('focus', loadDataFromBackground);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        loadDataFromBackground();
    }
});

// 修改筛选和排序函数，添加数据验证
function applyFiltersAndSort() {
    if (!Array.isArray(currentUsers)) {
        console.error('当前数据无效');
        return;
    }

    console.log('应用筛选前的用户数:', currentUsers.length);
    
    // 应用筛选
    filteredUsers = filterUsers(currentUsers);
    
    // 应用排序
    const sortField = document.getElementById('sortField').value;
    const sortOrder = document.getElementById('sortOrder').value;
    filteredUsers = sortUsers(filteredUsers, sortField, sortOrder);
    
    console.log('筛选后的用户数:', filteredUsers.length);
    
    // 更新显示
    updateStats(currentUsers, true);
}

// 添加定期统计输出
setInterval(async () => {
    if (document.visibilityState === 'visible') {
        const basicData = await chrome.runtime.sendMessage({ 
            action: 'getSavedData',
            version: 'basic'
        });
        
        const proData = await chrome.runtime.sendMessage({ 
            action: 'getSavedData',
            version: 'pro'
        });

        console.log('定期数据统计:', {
            '时间': new Date().toLocaleTimeString(),
            '基础版': {
                '总用户数': basicData?.savedUserList?.length || 0,
                '手机号用户': basicData?.savedUserList?.filter(u => u.phone)?.length || 0
            },
            '高级版': {
                '总用户数': proData?.savedUserList?.length || 0,
                '手机号用户': proData?.savedUserList?.filter(u => u.phone)?.length || 0
            }
        });
    }
}, 5000); // 每5秒输出一次统计