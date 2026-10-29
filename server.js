const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Dito natin ilalagay ang mga tanong. Pwede mo itong palitan ng 100 questions later.
const questions = [
    { question: "What does IIEE stand for?", options: ["Institute of Integrated Electrical Engineers", "International Institute of Electrical Engineering", "Integrated Institute of Electronic Engineers", "Institute of Industrial Electrical Engineers"], answer: 0 },
    { question: "Which company is hosting this event?", options: ["GEMCOR", "IIEE", "TechCorp", "ABC Corp"], answer: 0 },
    { question: "What color is the sky?", options: ["Red", "Blue", "Green", "Yellow"], answer: 1 }
];

let players = {}; // Dito natin i-save ang mga players
let currentQuestionIndex = -1;
let gameState = 'waiting'; // 'waiting', 'question', 'results', 'leaderboard'

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/player.html');
});

app.get('/host', (req, res) => {
    res.sendFile(__dirname + '/host.html');
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Kapag may sumali na player
    socket.on('joinGame', (name) => {
        players[socket.id] = { name: name, score: 0, hasAnswered: false };
        io.emit('updatePlayerCount', Object.keys(players).length);
    });

    // Kapag nag-start ang host
    socket.on('startGame', () => {
        currentQuestionIndex = -1;
        nextQuestion();
    });

    function nextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            gameState = 'question';
            // Reset player status
            for (let id in players) {
                players[id].hasAnswered = false;
            }
            
            const qData = {
                question: questions[currentQuestionIndex].question,
                options: questions[currentQuestionIndex].options,
                index: currentQuestionIndex
            };
            io.emit('newQuestion', qData);
        } else {
            gameState = 'leaderboard';
            io.emit('gameOver', getLeaderboard());
        }
    }

    // Kapag sumagot ang player
    socket.on('submitAnswer', (answerIndex) => {
        if (gameState === 'question' && players[socket.id] && !players[socket.id].hasAnswered) {
            const correctAnswer = questions[currentQuestionIndex].answer;
            const isCorrect = (answerIndex === correctAnswer);
            
            players[socket.id].hasAnswered = true;
            
            if (isCorrect) {
                // Basic scoring: +100 points kapag tama
                players[socket.id].score += 100; 
                socket.emit('answerResult', { correct: true, score: players[socket.id].score });
            } else {
                socket.emit('answerResult', { correct: false, score: players[socket.id].score });
            }
            
            // Notify host kung ilan na ang sumagot
            const answeredCount = Object.values(players).filter(p => p.hasAnswered).length;
            io.emit('updateAnsweredCount', answeredCount);
        }
    });

    // Kapag nag-reveal ang host ng sagot
    socket.on('revealAnswer', () => {
        gameState = 'results';
        const correctAnswer = questions[currentQuestionIndex].answer;
        io.emit('showResults', { correctAnswer: correctAnswer });
    });

    // Kapag pumindot ang host ng "Next" o "Show Leaderboard"
    socket.on('nextQuestion', () => {
        nextQuestion();
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayerCount', Object.keys(players).length);
    });
});

function getLeaderboard() {
    const leaderboard = Object.keys(players).map(id => ({
        name: players[id].name,
        score: players[id].score
    })).sort((a, b) => b.score - a.score).slice(0, 5); // Top 5 lang muna
    return leaderboard;
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Host Screen: http://localhost:${PORT}/host`);
});
