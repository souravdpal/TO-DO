const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const taskNameInput = document.getElementById('taskName');
const taskDurationInput = document.getElementById('taskDuration');
const taskCategorySelect = document.getElementById('taskCategory');
const taskPriorityInput = document.getElementById('taskPriority');
const taskNotesInput = document.getElementById('taskNotes');
const timerDisplay = document.getElementById('timerDisplay');
const startButton = document.getElementById('startButton');
const alertSound = document.getElementById('alertSound');
const themeSelect = document.getElementById('themeSelect');
const modeSelect = document.getElementById('modeSelect');
const soundSelect = document.getElementById('soundSelect');
const bgSelect = document.getElementById('bgSelect');
const pomodoroMode = document.getElementById('pomodoroMode');
const voiceNotify = document.getElementById('voiceNotify');
const mascot = document.getElementById('mascot');
const progressFill = document.getElementById('progressFill');

let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentTaskIndex = 0;
let timeLeft = 0;
let timerInterval = null;
let isBreak = false;
let draggedItem = null;

const soundOptions = {
    beep: 'https://www.soundjay.com/buttons/beep-01a.mp3',
    meow: 'https://www.myinstants.com/media/sounds/cute-cat-meow.mp3'
};

const categoryIcons = {
    work: '📝',
    fun: '🎉',
    home: '🏡'
};

const mascotMessages = {
    default: {
        start: "🐾 Let’s do this!",
        break: "😺 Time for a break!",
        done: "🎉 You’re the best!"
    },
    cute: {
        start: "🌸 You’re so kawaii! Let’s go!",
        break: "🍰 Take a sweet break!",
        done: "💖 Yay, you’re a superstar!"
    },
    motivation: {
        start: "💪 You’ve got this! Let’s crush it!",
        break: "🏋️ Recharge, then dominate!",
        done: "🔥 Victory is yours!"
    }
};

// Load initial state
renderTasks();
updateProgress();
setSound();
setTheme();
setMode();
setBackground();

// Form submission
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = taskNameInput.value;
    let duration = parseInt(taskDurationInput.value) * 60;
    const category = taskCategorySelect.value;
    const priority = parseInt(taskPriorityInput.value) || 0;
    const notes = taskNotesInput.value;
    if (pomodoroMode.checked) duration = 25 * 60;
    tasks.push({ name, duration, category, priority, notes, completed: false });
    saveTasks();
    renderTasks();
    taskNameInput.value = '';
    taskDurationInput.value = '';
    taskPriorityInput.value = '';
    taskNotesInput.value = '';
    startButton.disabled = false;
    updateProgress();
});

// Start timer
startButton.addEventListener('click', () => {
    if (tasks.length > 0 && !timerInterval) {
        startTimer();
    }
});

// Theme, mode, sound, and background switches
themeSelect.addEventListener('change', setTheme);
modeSelect.addEventListener('change', setMode);
soundSelect.addEventListener('change', setSound);
bgSelect.addEventListener('change', setBackground);

// Drag-and-Drop for Desktop
taskList.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li');
    if (li) {
        draggedItem = li;
        e.dataTransfer.setData('text/plain', li.dataset.index);
    }
});

taskList.addEventListener('dragover', (e) => e.preventDefault());

taskList.addEventListener('drop', (e) => {
    e.preventDefault();
    const fromIndex = e.dataTransfer.getData('text/plain');
    const toLi = e.target.closest('li');
    if (toLi) {
        const toIndex = toLi.dataset.index;
        const [movedTask] = tasks.splice(fromIndex, 1);
        tasks.splice(toIndex, 0, movedTask);
        saveTasks();
        renderTasks();
    }
});

// Touch Events for Mobile Drag-and-Drop
let touchStartY = 0;
let touchStartX = 0;
let touchMoved = false;

taskList.addEventListener('touchstart', (e) => {
    const li = e.target.closest('li');
    if (li) {
        draggedItem = li;
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        touchMoved = false;
        li.style.opacity = '0.5';
    }
});

taskList.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!draggedItem) return;
    touchMoved = true;
    const touch = e.touches[0];
    const offsetY = touch.clientY - touchStartY;
    const offsetX = touch.clientX - touchStartX;
    draggedItem.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
});

taskList.addEventListener('touchend', (e) => {
    if (!draggedItem) return;
    draggedItem.style.opacity = '1';
    draggedItem.style.transform = 'none';

    if (touchMoved) {
        const fromIndex = draggedItem.dataset.index;
        const touch = e.changedTouches[0];
        const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
        const toLi = dropTarget ? dropTarget.closest('li') : null;

        if (toLi && toLi !== draggedItem) {
            const toIndex = toLi.dataset.index;
            const [movedTask] = tasks.splice(fromIndex, 1);
            tasks.splice(toIndex, 0, movedTask);
            saveTasks();
            renderTasks();
        }
    }
    draggedItem = null;
});

function renderTasks() {
    taskList.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.index = index;
        const stars = '★'.repeat(task.priority) + '☆'.repeat(5 - task.priority);
        li.textContent = `${categoryIcons[task.category]} ${task.name} - ${task.duration / 60} min ${stars}`;
        if (task.notes) li.title = task.notes;
        if (task.completed) li.classList.add('completed');
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.onclick = () => {
            tasks.splice(index, 1);
            saveTasks();
            renderTasks();
            updateProgress();
        };
        li.appendChild(deleteBtn);
        taskList.appendChild(li);
    });
}

function startTimer() {
    const nextTask = tasks.findIndex(t => !t.completed);
    if (nextTask === -1) {
        const mode = modeSelect.value;
        timerDisplay.textContent = mascotMessages[mode].done;
        mascot.textContent = mascotMessages[mode].done;
        startButton.disabled = true;
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        if (voiceNotify.checked) speak("All tasks completed! You’re incredible!");
        return;
    }

    currentTaskIndex = nextTask;
    if (pomodoroMode.checked && !isBreak) {
        timeLeft = 25 * 60;
    } else if (pomodoroMode.checked && isBreak) {
        timeLeft = 5 * 60;
    } else {
        timeLeft = tasks[currentTaskIndex].duration;
    }
    updateTimerDisplay();
    const mode = modeSelect.value;
    mascot.textContent = isBreak ? mascotMessages[mode].break : mascotMessages[mode].start;

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            alertSound.play();
            if (pomodoroMode.checked) {
                if (!isBreak) {
                    tasks[currentTaskIndex].completed = true;
                    isBreak = true;
                    if (voiceNotify.checked) speak("Work done! Take a break!");
                } else {
                    isBreak = false;
                    if (voiceNotify.checked) speak("Break’s over! Let’s go!");
                }
            } else {
                tasks[currentTaskIndex].completed = true;
                if (voiceNotify.checked) speak(`${tasks[currentTaskIndex].name} is done!`);
            }
            saveTasks();
            renderTasks();
            updateProgress();
            setTimeout(startTimer, 1000);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const currentTask = tasks[currentTaskIndex] || { name: "None" };
    timerDisplay.textContent = `${isBreak ? "Break" : "Task"}: ${isBreak ? "Rest" : currentTask.name} | Time Left: ${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
}

function updateProgress() {
    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const percentage = total ? (completed / total) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
    const mode = modeSelect.value;
    mascot.textContent = percentage === 100 ? mascotMessages[mode].done : `${completed}/${total} done!`;
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function setTheme() {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(themeSelect.value);
}

function setMode() {
    document.body.classList.remove('default', 'cute', 'motivation');
    document.body.classList.add(modeSelect.value);
    updateProgress();
}

function setSound() {
    alertSound.src = soundOptions[soundSelect.value];
}

function setBackground() {
    document.body.classList.remove('stars', 'cats');
    if (bgSelect.value !== 'default') document.body.classList.add(bgSelect.value);
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.2;
        utterance.pitch = 1.5;
        speechSynthesis.speak(utterance);
    }
}
