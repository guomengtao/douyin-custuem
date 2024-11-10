// 更新统计信息和用户列表显示
function updateStats(users) {
    document.getElementById('totalUsers').textContent = users.length;
    const phoneUsers = users.filter(user => user.phone).length;
    document.getElementById('phoneUsers').textContent = phoneUsers;
    
    // 更新用户列表显示，显示所有用户（倒序排列）
    const userList = document.getElementById('userList');
    userList.innerHTML = users.map((user, index) => `
        <div class="user-item">
            <div><strong>序号：</strong>${users.length - index}</div>
            <div><strong>用户名：</strong>${user.username || '未知'}</div>
            <div><strong>抖音号：</strong>${user.douyinId || '未填写'}</div>
            <div><strong>公司名称：</strong>${user.companyName || '未填写'}</div>
            <div><strong>联系人：</strong>${user.name || '未填写'}</div>
            ${user.phone ? `<div><strong>手机号：</strong>${user.phone}</div>` : ''}
            ${user.wechat ? `<div><strong>微信号：</strong>${user.wechat}</div>` : ''}
            <div><strong>简介：</strong>${user.bio || '未填写'}</div>
        </div>
    `).reverse().join('');

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .user-item {
            padding: 10px;
            margin: 5px 0;
            border: 1px solid #eee;
            border-radius: 4px;
            background: #fff;
        }
        .user-item:hover {
            background: #f9f9f9;
        }
        .user-item div {
            margin: 3px 0;
            word-break: break-all;
        }
        .user-item strong {
            color: #666;
            display: inline-block;
            width: 80px;
        }
    `;
    document.head.appendChild(style);
}

// 修改 content.js 中的 extractUserInfo 函数来更新用户名获取方式
function extractUserInfo() {
    const userCards = Array.from(document.querySelectorAll('[class*="card"]')).filter(el => {
        return el.textContent.includes('抖音号') || 
               el.textContent.includes('粉丝') || 
               el.querySelector('a[href*="/user/"]');
    });
    
    console.log('找到用户卡片数量:', userCards.length);
    const newUserList = [];
    
    userCards.forEach(async user => {
        try {
            // 获取用户名 - 更新选择器以匹配新的结构
            const username = user.querySelector('.v9LWb7QE .j5WZzJdp span span span span')?.textContent.trim() ||
                           user.querySelector('.Yyd3Q8Ck .XQwChAbX .v9LWb7QE')?.textContent.trim() ||
                           user.querySelector('h4, [class*="title"], [class*="name"]')?.textContent.trim() || '';

            // ... 其余代码保持不变
        } catch (error) {
            console.error('提取用户信息错误:', error);
        }
    });
}

// 从 background 获取数据
async function loadDataFromBackground() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getSavedData' });
        if (response && response.savedUserList) {
            updateStats(response.savedUserList);
            return response.savedUserList;
        }
    } catch (error) {
        console.error('从 background 加载数据失败:', error);
    }
    return [];
}

// 初始化时加载数据
document.addEventListener('DOMContentLoaded', async () => {
    await loadDataFromBackground();
});

// 定期刷新数据
setInterval(loadDataFromBackground, 2000);

// 添加按钮事件监听器
document.getElementById('startCollect').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'collect' }, async response => {
            if (response && response.users) {
                updateStats(response.users);
            }
            // 无论采集是否成功，都重新从 background 加载数据
            await loadDataFromBackground();
        });
    }
});

document.getElementById('stopCollect').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'stop' });
    }
});

document.getElementById('exportAll').addEventListener('click', async () => {
    const users = await loadDataFromBackground();
    if (users && users.length > 0) {
        // 直接调用 background 的下载功能
        const txtContent = formatUsersToText(users);
        const blob = new Blob(['\ufeff' + txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        try {
            await chrome.runtime.sendMessage({
                action: 'downloadTXT',
                url: url,
                filename: `抖音用户数据_${new Date().toLocaleDateString()}.txt`
            });
            console.log('导出成功');
        } catch (error) {
            console.error('导出失败:', error);
        } finally {
            URL.revokeObjectURL(url);
        }
    }
});

document.getElementById('exportPhone').addEventListener('click', async () => {
    const users = await loadDataFromBackground();
    if (users && users.length > 0) {
        const phoneUsers = users.filter(user => user.phone);
        const txtContent = formatUsersToText(phoneUsers);
        const blob = new Blob(['\ufeff' + txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        try {
            await chrome.runtime.sendMessage({
                action: 'downloadTXT',
                url: url,
                filename: `抖音用户数据_手机号_${new Date().toLocaleDateString()}.txt`
            });
            console.log('导出手机号用户成功');
        } catch (error) {
            console.error('导出失败:', error);
        } finally {
            URL.revokeObjectURL(url);
        }
    }
});

document.getElementById('clearData').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearData' });
    updateStats([]);
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

// 添加格式化用户数据的函数
function formatUsersToText(users) {
    return users.map((user, index) => {
        const lines = [
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            `序号：${users.length - index}`,
            `用户名：${user.username || '未填写'}`,
            `抖音号：${user.douyinId || '未填写'}`,
            `公司名称：${user.companyName || '未填写'}`,
            `联系人：${user.name || '未填写'}`
        ];

        if (user.phone) lines.push(`手机号：${user.phone}`);
        if (user.wechat) lines.push(`微信号：${user.wechat}`);
        
        lines.push(
            `粉丝数：${user.fans || '未知'}`,
            `获赞数：${user.likes || '未知'}`,
            `简介：${user.bio || '未填写'}`,
            `主页：${user.userLink || '未知'}`
        );

        return lines.join('\n');
    }).join('\n\n');
}

// 在文件末尾添加
document.getElementById('switchVersion').addEventListener('click', () => {
    chrome.action.setPopup({ popup: 'popup_pro.html' });
    window.location.href = 'popup_pro.html';
});