(function() {
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
    window.requestAnimationFrame = requestAnimationFrame;
})();

var Util = {
    clamp: function(val, min, max) {
        return Math.min(Math.max(min, val), max);
    }
};

var Vector = function(x, y) {
    this.x = x;
    this.y = y;
};

Vector.prototype.translate = function(t) {
    return new Vector(this.x + t.x, this.y + t.y);
};

Vector.prototype.scale = function(scaling) {
    return new Vector(this.x * scaling, this.y * scaling);
};

Vector.prototype.same = function(t) {
    return this.x === t.x && this.y === t.y;
};

var delta = [
    new Vector(0, 1),
    new Vector(1, 0),
    new Vector(0, -1),
    new Vector(-1, 0)
];

var Map = function(name, width, height, obstacles) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.obstacles = obstacles;
};
//Popuplate maps

var borderSquares = [];
for (var i = 0; i < 30; ++i) {
    borderSquares.push(new Vector(i, 0));
    borderSquares.push(new Vector(i, 24));
}
for (var i = 0; i < 25; ++i) {
    borderSquares.push(new Vector(0, i));
    borderSquares.push(new Vector(29, i));
}

var maps = [
    new Map("Plain", 30, 25, []),
    new Map("Borders", 30, 25, borderSquares)
];

var Snake = function(headCoordinate, direction, game) {
    this.direction = direction;
    this.newDirection = direction;
    this.segments = [headCoordinate];
    this.isAlive = true;
    this.stomach = 0;
    this.alwaysShow = 0;
    this.game = game;
    this.speedModifier = 1;
};

Snake.prototype.move = function() {
    var cut = this.stomach === 0;
    if (!cut)
        this.stomach--;
    var length = this.segments.length;
    var head = this.segments[0];
    var tail = this.segments[length - 1];
    this.direction = this.newDirection;
    var newHead = this.getNext();
    if (!cut)
        this.segments.push(new Vector(0, 0));
    for (var i = length - (cut ? 1 : 0); i > 0; --i) {
        this.segments[i] = this.segments[i - 1];
    }
    this.segments[0] = newHead;
    return [newHead, tail];
};

Snake.prototype.turn = function(delta) {
    this.newDirection = (this.direction + delta + 4) % 4;
};

Snake.prototype.getHead = function() {
    return this.segments[0];
};

Snake.prototype.consume = function(food) {
    this.stomach += food.type.energy;
    for (var i = 0; i < food.type.powerUps.length; ++i) {
        switch (food.type.powerUps[i]) {
            case POWERUP_SHOW:
                this.alwaysShow = SHOW_DURATION;
                break;
            case POWERUP_FOOD_FRENZY:
                var sum = 0;
                for (var i = 1; i < FOOD_TYPES - 1; ++i)
                    sum += foodProbs[i];
                for (var i = 0; i < 5; ++i) {
                    var rnd = Math.random();
                    var cumul = 0;
                    for (var j = 1; j < FOOD_TYPES - 1; ++j) {
                        cumul += foodProbs[j] / sum;
                        if (rnd <= cumul + 1e-7) {
                            this.game.newFood(j);
                            break;
                        }
                    }
                }
                break;
            case POWERUP_SPEEDDOWN:
                this.speedModifier *= 1.2;
                break;
            case POWERUP_SPEEDDOWN:
                this.speedModifier *= 1 / 1.2;
                break;
            case POWERUP_CUTOFF:
                var segments = new Array(Math.floor(this.segments.length / 2 + 1));
                for (var i = 0; i < segments.length; ++i)
                    segments[i] = this.segments[i];
                this.segments = segments;
                break;
        }
    }
};

Snake.prototype.count = function(coordinate) {
    var count = 0;
    for (var i = 0; i < this.segments.length; ++i) {
        if (coordinate.same(this.segments[i]))
            count++;
    }
    return count;
};

Snake.prototype.getNext = function() {
    var coord = this.segments[0].translate(delta[this.newDirection]);
    coord.x = (coord.x + this.game.board.width) % this.game.board.width;
    coord.y = (coord.y + this.game.board.height) % this.game.board.height;
    return coord;
};

var FoodType = function(energy, hunger, expiry, colorHue, powerUps) {
    this.energy = energy;
    this.hunger = hunger;
    this.expiry = expiry;
    this.hue = colorHue;
    this.powerUps = powerUps;
};

var POWERUP_SHOW = 0;
var POWERUP_FOOD_FRENZY = 1;
var POWERUP_SPEEDUP = 2;
var POWERUP_SPEEDDOWN = 3;
var POWERUP_CUTOFF = 4;

var SHOW_DURATION = 5000;

var FOOD_TYPES = 5;
var POWERUP_COUNT = 2;

var foodTypes = [
    new FoodType(1, 0.1, -1, 100, []), //green
    new FoodType(3, 1, 20000, 290, []), //violett
    new FoodType(3, -0.4, 20000, 290, []), //violett
    new FoodType(3, 0.3, 10000, 240, []), //blue
    new FoodType(5, -0.2, 30000, 0, []), //red
    new FoodType(0, 0.5, 15000, 30, [POWERUP_SHOW]), //orange
    new FoodType(0, 0, 15000, 170, [POWERUP_FOOD_FRENZY]), //cyan
    new FoodType(0, 0, 15000, 95, [POWERUP_SPEEDUP]), //greenish
    new FoodType(0, 0, 15000, 270, [POWERUP_SPEEDDOWN]), //purple
    new FoodType(0, 0, 15000, 220, [POWERUP_CUTOFF]) //blue
];
var foodProbs = [0, 0.01, 0.001, 0.02, 0.005, 0.002, 0.002, 0.002, 0.002, 0.002];

var Food = function(coordinate, type) {
    this.coordinate = coordinate;
    this.type = type;
    this.placed = Date.now();
};

Food.prototype.isExpired = function() {
    return this.type.expiry > 0 && Date.now() - this.placed > this.type.expiry;
};


var INITIAL_SPEED = 300;

function make2DArray(width, height, fill) {
    var array = new Array(width);
    for (var i = 0; i < width; ++i) {
        array[i] = new Array(height);
        for (var j = 0; j < height; ++j) {
            array[i][j] = fill;
        }
    }
    return array;
}

var Board = function(map) {
    this.width = map.width;
    this.height = map.height;
    this.filled = make2DArray(this.width, this.height, false);
    this.obstacle = make2DArray(this.width, this.height, false);
    for (var i = 0; i < map.obstacles.length; ++i) {
        var obst = map.obstacles[i];
        this.obstacle[obst.x][obst.y] = this.filled[obst.x][obst.y] = true;
    }
};

Board.prototype.setOccupied = function(coordinate, status) {
    this.filled[coordinate.x][coordinate.y] = status;
};

Board.prototype.isOccupied = function(coordinate) {
    return this.filled[coordinate.x][coordinate.y];
};

Board.prototype.isWithin = function(coordinate) {
    return coordinate.x >= 0 && coordinate.y >= 0 && coordinate.x < this.width && coordinate.y < this.height;
};

Board.prototype.isObstacle = function(coordinate) {
    return this.obstacle[coordinate.x][coordinate.y];
};

var TILE_SIZE = 20;

var Renderer = function(canvasId, game) {
    this.canvasId = canvasId;
    this.game = game;
    this.tileSize = TILE_SIZE;
    var canvas = document.getElementById(canvasId);
    canvas.width = game.board.width * TILE_SIZE;
    canvas.height = game.board.height * TILE_SIZE + 70;
    this.snakeLight = 100;
    this.lastRender = Date.now();
};

CanvasRenderingContext2D.prototype.drawCircle = function(x, y, diameter) {
    this.beginPath();
    var cx = x + diameter / 2;
    var cy = y + diameter / 2;
    this.arc(cx, cy, diameter / 2, 0, 2 * Math.PI, false);
    return this;
};

CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    //From http://stackoverflow.com/questions/1255512/how-to-draw-a-rounded-rectangle-on-html-canvas
    if (w < 2 * r)
        r = w / 2;
    if (h < 2 * r)
        r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
};

Renderer.prototype.render = function() {
    var ctx = document.getElementById(this.canvasId).getContext('2d');
    var game = this.game;
    this.renderBackground(ctx, game);
    this.renderBoard(ctx, game);
    this.renderSnake(ctx, game);
    this.renderFood(ctx, game);
    this.renderMeter(ctx, game);
    this.lastRender = Date.now();
};

Renderer.prototype.renderBackground = function(ctx, game) {
    ctx.save();
    ctx.rect(0, 0, game.board.width * TILE_SIZE, game.board.height * TILE_SIZE);
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fill();
    ctx.restore();
};

Renderer.prototype.renderBoard = function(ctx, game) {
    ctx.save();
    ctx.fillStyle = "rgb(150, 150, 150)";
    for (var i = 0; i < game.board.width; ++i)
        for (var j = 0; j < game.board.height; ++j)
            if (game.board.obstacle[i][j]) {
                ctx.fillRect(i * TILE_SIZE, j * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
    ctx.restore();
};

Renderer.prototype.renderMeter = function(ctx, game) {
    ctx.save();
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillRect(0, game.board.height * TILE_SIZE, game.board.width * TILE_SIZE, 70);
    ctx.translate(0.5, 0.5); //FIXME: hack för att undvika antialiasing
    ctx.lineWidth = 0;
    ctx.strokeStyle = "rgb(0, 0, 0)";
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.strokeRect(20, game.board.height * TILE_SIZE + 10, game.board.width * TILE_SIZE - 40, 30);
    ctx.fillRect(20, game.board.height * TILE_SIZE + 10, (game.board.width * TILE_SIZE - 40) * (1 - game.hunger), 30);
    ctx.fillText("Score: " + Math.floor(game.score), 20, game.board.height * TILE_SIZE + 54);
    ctx.restore();
};

Renderer.prototype.updatePulse = function(hunger, elapsed, current) {
    var color = current > 1 ? 2 - current : current;
    var rising = current < 1;
    var derivative = elapsed / 1000 * 0.7;
    if (current < 0.05) {
        derivative *= 1.032 - Math.pow(hunger, 0.1);
    }
    current += derivative;
    while (current > 2)
        current -= 2;
    return current;
};

Renderer.prototype.renderSnake = function(ctx, game) {
    ctx.save();
    var snakeSegments = game.snake.segments;
    this.snakeLight = this.updatePulse(game.hunger, Date.now() - this.lastRender, this.snakeLight);
    var snakeLight = this.snakeLight;
    if (snakeLight > 1)
        snakeLight = 2 - snakeLight;
    if (snakeLight < 0.05)
        snakeLight = 0;
    if (game.snake.alwaysShow > 0 || !game.snake.isAlive) {
        snakeLight = 1;
    }
    for (var i = 0; i < snakeSegments.length; ++i) {
        var coord = snakeSegments[i];
        ctx.fillStyle = "rgb(0,0,0)";
        ctx.roundRect(coord.x * TILE_SIZE + 5, coord.y * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10, 5).fill();
        ctx.strokeStyle = "hsl(0, 100%, " + snakeLight * 0.6 * 100 + "%)";
        ctx.roundRect(coord.x * TILE_SIZE + 5, coord.y * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10, 5).stroke();
    }
    ctx.restore();
};

Renderer.prototype.renderFood = function(ctx, game) {
    ctx.save();
    var foods = game.foods;
    var pulse = (Date.now() / 20) % 200;
    if (pulse > 100)
        pulse = 200 - pulse;
    pulse = 20 + pulse / 3;
    ctx.shadowBlur = 30;
    for (var i = 0; i < foods.length; ++i) {
        ctx.fillStyle = "hsl(" + foods[i].type.hue + ", 100%, " + pulse + "%)";
        ctx.shadowColor = "hsl(" + foods[i].type.hue + ", 100%, " + (pulse + 20) + "%)";
        var coord = foods[i].coordinate;
        if (foods[i].type.powerUps.length > 0) {
            //Food is powerup - draw square
            ctx.fillRect((coord.x + 0.1) * TILE_SIZE, (coord.y + 0.1) * TILE_SIZE, TILE_SIZE * 0.8, TILE_SIZE * 0.8);
        } else {
            ctx.drawCircle((coord.x + 0.1) * TILE_SIZE, (coord.y + 0.1) * TILE_SIZE, TILE_SIZE * 0.8).fill();
        }
    }
    ctx.restore();
};

var INITIAL_LENGTH = 5;

var Game = function(input, map) {
    this.score = 0;
    this.board = new Board(map);
    this.snake = new Snake(new Vector(Math.floor(this.board.width / 2) - INITIAL_LENGTH, Math.floor(this.board.height / 2)), 1, this);
    this.snake.stomach = INITIAL_LENGTH - 1;
    for (var i = 1; i < INITIAL_LENGTH; ++i) {
        this.snake.move();
    }
    for (var i = 0; i < this.snake.segments.length; ++i) {
        this.board.setOccupied(this.snake.segments[i], true);
    }
    this.foods = [];
    this.tickSpeed = INITIAL_SPEED;
    this.input = input;
    this.running = false;
};

Game.prototype.getFood = function(coordinate) {
    for (var i = 0; i < this.foods.length; ++i) {
        var foodCoord = this.foods[i].coordinate;
        if (coordinate.same(foodCoord)) {
            return i;
        }
    }
    return -1;
};

Game.prototype.newFood = function(type) {
    var vec = new Vector(0, 0);
    do {
        vec.x = Math.floor(Math.random() * this.board.width);
        vec.y = Math.floor(Math.random() * this.board.height);
    } while (this.board.isOccupied(vec));
    this.board.setOccupied(vec, true);
    this.foods.push(new Food(vec, foodTypes[type]));
};

Game.prototype.update = function() {
    //Consume input
    if (this.input.isLeft) {
        this.snake.turn(1);
        this.input.isLeft = false;
    }
    if (this.input.isRight) {
        this.snake.turn(-1);
        this.input.isRight = false;
    }
    this.snake.alwaysShow = Math.max(this.snake.alwaysShow - this.tickSpeed, 0);
    var newHead = this.snake.getNext();
    for (var i = 0; i < this.foods.length; ++i) {
        if (this.foods[i].isExpired()) {
            this.foods.splice(i, 1);
            --i;
        }
    }
    var foodIndex = this.getFood(newHead);
    if (foodIndex !== -1) {
        var food = this.foods[foodIndex];
        this.snake.consume(food);
        this.foods.splice(foodIndex, 1);
        this.hunger = Math.max(0, this.hunger - food.type.hunger);
        if (food.type === foodTypes[0])
            this.newFood(0);
    }
    for (var i = 0; i < foodTypes.length; ++i) {
        if (Math.random() < foodProbs[i]) {
            this.newFood(i);
        }
    }
    var ends = this.snake.move();
    var head = ends[0];
    var tail = ends[1];
    if (this.hunger > 1 - 1e-4 || this.snake.count(head) > 1 || !this.board.isWithin(head) || this.board.isObstacle(head)) {
        this.snake.isAlive = false;
        this.gameOver();
        return;
    }
    this.board.setOccupied(tail, false);
    this.board.setOccupied(head, true);
    this.tickSpeed = Math.max(30, INITIAL_SPEED - 3 * this.snake.segments.length) * this.snake.speedModifier;
    this.score += (1 - this.hunger) * this.snake.segments.length;
    return;
};

Game.prototype.gameOver = function() {
    var highscore = window.localStorage.getItem("highscore") || 0;
    alert("You died :(\nYour score was: " + Math.floor(this.score) + ".\nYour previous high score is " + highscore + ".\n" + (this.score > highscore ? "You pwned it!" : "Better luck next time."));
    if (this.score > highscore)
        window.localStorage.setItem("highscore", Math.floor(this.score));
    this.running = false;
};

Game.prototype.tick = function() {
    if (!this.running) {
        return;
    }
    var elapsed = Date.now() - this.lastTick;
    this.hunger = Math.min(1, this.hunger + elapsed * 0.0000033);
    if (elapsed > this.tickSpeed) {
        this.lastTick += elapsed;
        this.update();
    }
    this.renderer.render();
    //Request new animation
    var t = this;
    window.requestAnimationFrame(function() {
        t.tick();
    });
};

Game.prototype.start = function() {
    this.running = true;
    this.startTime = Date.now();
    this.lastTick = Date.now();
    this.newFood(0);
    this.hunger = 0;
    this.tick();
};

var LEFT_ARROW = 37;
var RIGHT_ARROW = 39;

var Input = function() {
    this.leftCode = LEFT_ARROW;
    this.rightCode = RIGHT_ARROW;
    this.isLeft = false;
    this.isRight = false;
    this.ignoreNext = false;
};

Input.prototype.keyDown = function(key) {
    if (this.ignoreNext) {
        this.ignoreNext = false;
        return;
    }

    switch (key) {
        case this.leftCode:
            this.isLeft = true;
            break;
        case this.rightCode:
            this.isRight = true;
            break;
    }
};

Input.prototype.keyUp = function(key) {
};


var game;

function startGame() {
    if(typeof game !== "undefined"){
        game.running = false;
    }
    var input = new Input();
    game = new Game(input, maps[$("#mapChooser").val()]);
    var renderer = new Renderer("snake", game);
    $("body").bind({
        keydown: function(e) {
            var key = e.keyCode;
            input.keyDown(key);
        },
        keyup: function(e) {
            var key = e.keyCode;
            input.keyUp(key);
        }
    });

    game.renderer = renderer;
    game.start();
}

$(document).ready(function() {

    for (var i = 0; i < maps.length; ++i) {
        $("#mapChooser").append("<option value=" + i + " label='" + maps[i].name + "' />");
    }
    
    $("#startButton").click(function(){
        startGame();
        game.input.ignoreNext = true;
    });

    $("body").click(function (e) {
        game.input.keyDown (e.pageX > document.width/2 ? RIGHT_ARROW : LEFT_ARROW);
    })
});