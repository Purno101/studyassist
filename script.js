// ============================================
// GLOBAL STATE & CONFIGURATION
// ============================================
let PP = 0
let XP = 0
let tasks = []
let history = []
let currentLevel = 1
let streak = 0
let lastStudyDate = null
let bossEvent = null
let audioUnlocked = false

let achievements = {
    firstTask: false,
    streak3: false,
    streak7: false,
    level5: false
}

const sounds = {
    interface: new Audio("sounds/interface.mp3"),
    lvlup: new Audio("sounds/lvlup.mp3"),
    taskComplete: new Audio("sounds/taskComplete.mp3"),
    progressBar: new Audio("sounds/progressBar.mp3"),
    error: new Audio("sounds/error.mp3"),
    acceptBoss: new Audio("sounds/acceptBoss.mp3")
}

// ============================================
// PWA DETECTION & SERVICE WORKER
// ============================================
// Detect if running as installed PWA vs browser
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    console.log(" App running in standalone mode (installed PWA)")
    // In PWA mode, we rely on cache
} else {
    console.log(" App running in browser mode")
}

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Clear any old service workers first
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for(let registration of registrations) {
        registration.unregister()
        console.log("Old service worker unregistered")
      }
    }).then(() => {
      // Register new service worker
      navigator.serviceWorker.register("serviceWorker.js")
        .then(registration => {
          console.log("✅ ServiceWorker registered successfully: ", registration)
        })
        .catch(error => {
          console.log("❌ ServiceWorker registration failed: ", error)
        })
    })
  })
}

// ============================================
// INITIALIZATION
// ============================================
loadData()
checkDailyReset()
renderTasks()
updateUI()
updateLevel()
checkBossSpawn()
renderHistory()

document.getElementById("streak").innerText = streak

// ============================================
// AUDIO & NOTIFICATION SYSTEM
// ============================================
function requestNotificationPermission() {
    if (!("Notification" in window)) return

    if (Notification.permission === "default") {
        Notification.requestPermission()
    }
}

function sendNotification(title, body) {
    if (Notification.permission !== "granted") return

    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
            reg.showNotification(title, {
                body: body,
                icon: "icon.png",
                badge: "icon.png"
            })
        }
    })
}

function unlockAudio() {
    if (audioUnlocked) {
        return;
    }
    playSound("interface");
    Object.values(sounds).forEach(sound => {
        sound.play().then(() => {
            sound.pause()
            sound.currentTime = 0
        }).catch(() => {})
    })

    audioUnlocked = true
}

function playSound(name) {
    let sound = sounds[name]

    if (!sound) return

    let clone = sound.cloneNode()
    clone.play().catch(() => {})
}

// ============================================
// ACHIEVEMENT SYSTEM
// ============================================
function checkAchievements() {
    if (!achievements.firstTask && XP > 0) {
        achievements.firstTask = true
        sendNotification("Achievement Unlocked 🏆", "First Task Completed!")
    }

    if (!achievements.streak3 && streak >= 3) {
        achievements.streak3 = true
        sendNotification("Achievement 🏆", "3 Day Study Streak!")
    }

    if (!achievements.streak7 && streak >= 7) {
        achievements.streak7 = true
        sendNotification("Achievement 🏆", "7 Day Study Streak!")
    }

    if (!achievements.level5 && currentLevel >= 5) {
        achievements.level5 = true
        sendNotification("Achievement 🏆", "Reached Level 5!")
    }
}

// ============================================
// STREAK SYSTEM
// ============================================
function updateStreak() {
    let today = new Date().toDateString()

    if (lastStudyDate === today) return

    let yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday = yesterday.toDateString()

    if (lastStudyDate === yesterday) {
        streak++
    } else {
        streak = 1
    }

    lastStudyDate = today
    document.getElementById("streak").innerText = streak + " 🔥"
    saveData()
}

// ============================================
// TASK MANAGEMENT
// ============================================
function addTask() {
    // Check if ANY boss battle exists (active OR paused)
    let hasAnyBoss = tasks.some(task => task.difficulty === "boss")
    
    if (hasAnyBoss) {
        playSound("error")
        
        // Show message in bossBox
        let bossBox = document.getElementById("bossBox")
        let originalContent = bossBox.innerHTML
        bossBox.innerHTML = `
            ⚔ Boss Battle Active! <br>
            Complete or defeat the boss first.<br>
            <small style="color: #ff6b6b;">Cannot add new tasks until boss is defeated</small>
        `
        
        // Restore original content after 3 seconds
        setTimeout(() => {
            if (bossEvent && !bossEvent.accepted) {
                showBossUI()
            } else {
                bossBox.innerHTML = "⚔ Boss Battle Active! <br> Complete the study session to defeat the boss."
            }
        }, 3000)
        return
    }

    let subject = document.getElementById("subject").value
    let text = document.getElementById("taskText").value
    let difficulty = document.getElementById("difficulty").value

    if (subject == "" || text == "" || difficulty == "") {
        playSound("error")
        alert("Select subject, description, and difficulty")
        return
    }

    let time = 0
    let rewardPP = 0
    let rewardXP = 0

    if (difficulty == "easy") {
        time = 600
        rewardPP = 10
        rewardXP = 5
    }

    if (difficulty == "medium") {
        time = 1500
        rewardPP = 20
        rewardXP = 10
    }

    if (difficulty == "hard") {
        time = 2700
        rewardPP = 40
        rewardXP = 20
    }

    let task = {
        id: Date.now(),
        subject,
        text,
        difficulty,
        end: Date.now() + time * 1000,
        remaining: time,
        paused: false,
        pp: rewardPP,
        xp: rewardXP
    }

    tasks.push(task)
    document.getElementById("taskText").value = ""
    saveData()
    renderTasks()
}

function renderTasks() {
    let container = document.getElementById("taskList")
    container.innerHTML = ""

    // Check if boss battle exists for warning message
    let hasBossTask = tasks.some(task => task.difficulty === "boss")
    
    if (hasBossTask) {
        // Add a subtle indicator in the task list
        let warningDiv = document.createElement("div")
        warningDiv.className = "boss-warning"
        warningDiv.style.cssText = "background: #ffd93d22; padding: 5px; margin-bottom: 10px; border-radius: 5px; color: #ffd93d; text-align: center; font-size: 0.9em;"
        warningDiv.innerHTML = "⚔ Boss Battle Active - Cannot add new tasks"
        container.appendChild(warningDiv)
    }

    tasks.forEach(task => {
        let div = document.createElement("div")
        div.className = "task"
        div.dataset.id = task.id

        // Calculate initial remaining time
        let remaining = Math.max(Math.floor((task.end - Date.now()) / 1000), 0)
        let isCompleted = remaining <= 0

        div.innerHTML = `
<b>${task.subject}</b> — ${task.text} (${task.difficulty})
<p class="timer">${isCompleted ? "✅ Task Ready" : formatTime(remaining)}</p>
<button class="pauseBtn" ${isCompleted ? 'style="display:none;"' : ''}>${task.paused ? "▶ Resume" : "⏸ Pause"}</button>
<button class="doneBtn" ${isCompleted ? '' : 'disabled'}>Done</button>
`
        container.appendChild(div)
        
        // Only start timer if task is not completed
        if (!isCompleted) {
            startTimer(div, task)
        }
    })
}

function startTimer(taskElement, task) {
    let timerElement = taskElement.querySelector(".timer")
    let pauseBtn = taskElement.querySelector(".pauseBtn")
    let doneBtn = taskElement.querySelector(".doneBtn")
    let interval

    function update() {
        if (task.paused) return

        let remaining = Math.max(
            Math.floor((task.end - Date.now()) / 1000),
            0
        )

        if (remaining <= 0) {
            timerElement.innerText = "✅ Task Ready"
            doneBtn.disabled = false
            pauseBtn.style.display = "none"
            clearInterval(interval)
            saveData()
            return
        }

        timerElement.innerText = formatTime(remaining)
    }

    pauseBtn.onclick = () => {
        if (!task.paused) {
            task.paused = true
            task.remaining = Math.floor((task.end - Date.now()) / 1000)
            pauseBtn.innerText = "▶ Resume"
        } else {
            task.paused = false
            task.end = Date.now() + task.remaining * 1000
            pauseBtn.innerText = "⏸ Pause"
            // Restart the timer update when resuming
            clearInterval(interval)
            interval = setInterval(update, 1000)
            update()
        }
        saveData()
    }

    doneBtn.onclick = () => completeTask(task.id)

    interval = setInterval(update, 1000)
    update()
}

function formatTime(sec) {
    let m = Math.floor(sec / 60)
    let s = sec % 60
    return m + ":" + String(s).padStart(2, "0")
}

function completeTask(id) {
    let task = tasks.find(t => t.id === id)
    
    if (!task) return

    // Check if this is a boss task being completed
    let wasBossTask = task.difficulty === "boss"

    // BOSS DEFEATED CHECK
    if(wasBossTask){
        let bossBox = document.getElementById("bossBox")
        bossBox.innerHTML = "🏆 Boss Defeated! You can now add new tasks."
        
        setTimeout(()=>{
            bossBox.style.display = "none"
        },3000)

        bossEvent = null
        localStorage.removeItem("bossEvent")
    }

    PP += task.pp
    XP += task.xp

    playSound("taskComplete")

    // Save to history
    let entry = {
        subject: task.subject,
        text: task.text,
        difficulty: task.difficulty,
        xp: task.xp,
        pp: task.pp,
        completedAt: new Date().toISOString()
    }

    history.push(entry)
    
    // Clean up old history after adding new entry
    cleanupOldHistory()
    
    tasks = tasks.filter(t => t.id !== id)
    
    sendNotification(
        "Task Completed 🎉",
        "+" + task.xp + " XP earned"
    )
    
    updateStreak()
    updateUI()
    updateLevel()
    checkAchievements()
    checkReward()

    saveData()
    renderTasks()
    renderHistory()
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================
function updateUI() {
    document.getElementById("pp").innerText = PP
    document.getElementById("xp").innerText = XP

    let percent = Math.min(PP, 100)
    document.getElementById("progress").style.width = percent + "%"

    if (percent === 100) {
        playSound("progressBar")
    }
}

function checkReward() {
    let reward = ""

    if (PP >= 100)
        reward = "🎉 Reward: 45 min Coding"
    else if (PP >= 60)
        reward = "📖 Reward: Novel Time"
    else if (PP >= 30)
        reward = "💻 Reward: 15 min Coding"

    document.getElementById("reward").innerText = reward
}

// ============================================
// LEVEL & XP SYSTEM
// ============================================
function updateLevel() {
    let level = 1
    let xpRemaining = XP

    while (xpRemaining >= level * 50) {
        xpRemaining -= level * 50
        level++
    }

    if (level > currentLevel) {
        playSound("lvlup")
        sendNotification(
            "Level Up! 🆙",
            "You reached level " + level
        )
        currentLevel = level
    }

    let xpNeeded = level * 50
    document.getElementById("level").innerText = level

    let percent = (xpRemaining / xpNeeded) * 100
    document.getElementById("xpProgress").style.width = percent + "%"
    document.getElementById("xpText").innerText = xpRemaining + " / " + xpNeeded + " XP"

    checkAchievements()
}

// ============================================
// DATA PERSISTENCE
// ============================================
function saveData() {
    localStorage.setItem("PP", PP)
    localStorage.setItem("XP", XP)
    localStorage.setItem("tasks", JSON.stringify(tasks))
    localStorage.setItem("history", JSON.stringify(history))
    localStorage.setItem("streak", streak)
    localStorage.setItem("lastStudyDate", lastStudyDate)
    localStorage.setItem("achievements", JSON.stringify(achievements))
}

function loadData() {
    PP = parseInt(localStorage.getItem("PP")) || 0
    XP = parseInt(localStorage.getItem("XP")) || 0
    streak = parseInt(localStorage.getItem("streak")) || 0
    lastStudyDate = localStorage.getItem("lastStudyDate")

    let savedTasks = localStorage.getItem("tasks")
    let savedHistory = localStorage.getItem("history")
    let savedAchievements = localStorage.getItem("achievements")
    let savedBoss = localStorage.getItem("bossEvent")

    if (savedTasks) {
        tasks = JSON.parse(savedTasks)
        
        // Fix any tasks that might have expired while app was closed
        tasks.forEach(task => {
            if (task.paused) {
                task.end = Date.now() + task.remaining * 1000
            } else {
                // Check if task expired while app was closed
                if (task.end < Date.now()) {
                    task.remaining = 0
                }
            }
        })
    }

    if (savedHistory) {
        history = JSON.parse(savedHistory)
        cleanupOldHistory() // Add this line here
    }

    if (savedAchievements) {
        achievements = JSON.parse(savedAchievements)
    }

    if (savedBoss) {
        bossEvent = JSON.parse(savedBoss)
        if (!bossEvent.accepted && Date.now() < bossEvent.expires) {
            showBossUI()
        }
    }
}

// ============================================
// DAILY RESET & REMINDERS
// ============================================
function checkDailyReset() {
    let lastReset = localStorage.getItem("lastReset")
    let now = new Date()
    let today5am = new Date()
    today5am.setHours(5, 0, 0, 0)

    if (!lastReset) {
        localStorage.setItem("lastReset", now)
        return
    }

    lastReset = new Date(lastReset)

    if (now >= today5am && lastReset < today5am) {
        PP = 0
        tasks = []
        localStorage.removeItem("tasks")
        localStorage.setItem("lastReset", now)
        saveData()
    }
}

function studyReminder() {
    let hour = new Date().getHours()
    if (hour === 18) {
        sendNotification(
            "Study Reminder 📚",
            "You haven't completed a task today!"
        )
    }
}

// ============================================
// BOSS EVENT SYSTEM
// ============================================
function checkBossSpawn() {
    let today = new Date().toDateString()
    let lastBossDay = localStorage.getItem("lastBossDay")

    if (lastBossDay === today) return

    // Check if there's ANY boss task (active OR paused)
    let hasAnyBoss = tasks.some(task => task.difficulty === "boss")
    
    if (hasAnyBoss) {
        // Don't spawn new boss if one already exists in any state
        return
    }

    let chance = Math.random()
    if (chance < 0.35) { // 35% chance per day
        let now = Date.now()
        bossEvent = {
            spawnTime: now,
            expires: now + 3 * 60 * 60 * 1000,
            accepted: false
        }

        localStorage.setItem("bossEvent", JSON.stringify(bossEvent))
        localStorage.setItem("lastBossDay", today)
        showBossUI()

        sendNotification(
            "⚔ Boss Appeared!",
            "Accept within 3 hours for 200 XP"
        )
    }
}

function acceptBoss(){
    if(!bossEvent) return

    // Check if ANY boss task exists
    let hasAnyBoss = tasks.some(task => task.difficulty === "boss")
    
    if (hasAnyBoss) {
        playSound("error")
        let bossBox = document.getElementById("bossBox")
        bossBox.innerHTML = `
            ⚔ Boss Battle Already Active! <br>
            Complete the current boss mission first.<br>
            <small style="color: #ff6b6b;">Cannot accept another boss</small>
        `
        setTimeout(() => {
            bossBox.innerHTML = "⚔ Boss Battle Active! <br> Complete the study session to defeat the boss."
        }, 3000)
        return
    }

    // Play the accept boss sound
    playSound("acceptBoss")

    let task={
        id:Date.now(),
        subject:"Boss Battle ⚔",
        text:"2 Hour Deep Study",
        difficulty:"boss",
        end:Date.now()+7200*1000,
        remaining:7200,
        paused:false,
        pp:100,
        xp:200
    }

    tasks.push(task)
    bossEvent.accepted = true
    localStorage.setItem("bossEvent",JSON.stringify(bossEvent))

    let bossBox = document.getElementById("bossBox")
    bossBox.innerHTML = `
⚔ Boss Battle Active! <br>
Complete the study session to defeat the boss.<br>
<small style="color: #ffd93d;">⚠️ Cannot add new tasks until boss is defeated</small>
`

    saveData()
    renderTasks()
}

function showBossUI(){
    let bossBox = document.getElementById("bossBox")
    if(!bossEvent) return

    bossBox.style.display = "block"
    bossBox.innerHTML = `
⚔ Boss Challenge Available! <br>
Accept within 3 hours.<br>
<button onclick="acceptBoss()">Accept Challenge</button>
`
}

function checkBossExpiration(){
    if(!bossEvent) return

    if(!bossEvent.accepted && Date.now() > bossEvent.expires){
        sendNotification(
            "Boss Escaped!",
            "You missed today's boss challenge."
        )

        let bossBox = document.getElementById("bossBox")
        bossBox.innerHTML = "💨 Boss escaped..."
        setTimeout(()=>{
            bossBox.style.display = "none"
        },3000)

        bossEvent = null
        localStorage.removeItem("bossEvent")
    }
}

function isBossBattleActive() {
    return tasks.some(task => 
        task.difficulty === "boss" && 
        !task.paused && 
        task.end > Date.now()
    )
}

// ============================================
// HISTORY
// ============================================
function renderHistory() {
    let container = document.getElementById("historyList")
    if (!container) return

    container.innerHTML = ""

    // Show info message only if there's history
    if (history.length > 0) {
        let infoDiv = document.createElement("div")
        infoDiv.className = "history-info"
        infoDiv.style.cssText = "background: #2a2a2a; padding: 8px; margin-bottom: 15px; border-radius: 8px; color: #888; text-align: center; font-size: 0.9em; border-left: 3px solid #4CAF50;"
        infoDiv.innerHTML = "📅 History will keep its data for past 3 days!"
        container.appendChild(infoDiv)
    }

    let days = {}

    history.forEach(entry => {
        let date = new Date(entry.completedAt)
        let dayKey = date.toLocaleDateString()

        if (!days[dayKey]) {
            days[dayKey] = {
                tasks: [],
                xp: 0,
                pp: 0
            }
        }

        days[dayKey].tasks.push(entry)
        days[dayKey].xp += entry.xp
        days[dayKey].pp += entry.pp
    })

    let sortedDays = Object.keys(days).reverse()

    // If no history at all, show a friendly message
    if (sortedDays.length === 0) {
        let emptyDiv = document.createElement("div")
        emptyDiv.className = "empty-history"
        emptyDiv.style.cssText = "background: #1a1a1a; padding: 20px; border-radius: 8px; color: #666; text-align: center; font-style: italic;"
        emptyDiv.innerHTML = "✨ No study history yet. Complete some tasks to see them here!"
        container.appendChild(emptyDiv)
        return
    }

    sortedDays.forEach(day => {
        let dayBlock = document.createElement("div")
        dayBlock.className = "historyDay"

        let header = document.createElement("div")
        header.className = "historyHeader"
        header.innerHTML = `
            <b>📅 ${day}</b>
            <br>
            ⭐ ${days[day].xp} XP earned | 🪙 ${days[day].pp} PP
        `

        dayBlock.appendChild(header)

        days[day].tasks.slice().reverse().forEach(entry => {
            let time = new Date(entry.completedAt)
                .toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})

            let item = document.createElement("div")
            item.className = "historyItem"
            item.innerHTML = `
                ${time} — <b>${entry.subject}</b> (${entry.difficulty})
                <br>
                ${entry.text}
                <br>
                +${entry.xp} XP | +${entry.pp} PP
            `

            dayBlock.appendChild(item)
        })

        container.appendChild(dayBlock)
    })
}

function cleanupOldHistory() {
    // Keep only last 3 days of history
    let threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    threeDaysAgo.setHours(0, 0, 0, 0) // Start of day 3 days ago
    
    let beforeCleanup = history.length
    
    history = history.filter(entry => {
        return new Date(entry.completedAt) >= threeDaysAgo
    })
    
    let afterCleanup = history.length
    let removedCount = beforeCleanup - afterCleanup
    
    if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} old history entries`)
        saveData()
        renderHistory()
    }
}

// ============================================
// EVENT LISTENERS & INTERVALS
// ============================================
document.addEventListener("click", unlockAudio)
document.addEventListener("touchstart", unlockAudio)

window.addEventListener('load', () => {
    playSound("interface")
    requestNotificationPermission()
    cleanupOldHistory() // Add this line
})

setInterval(checkBossExpiration, 60000)
setInterval(studyReminder, 3600000)