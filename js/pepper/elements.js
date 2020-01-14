/**
 * @overview Litemint Pepper Elements implementation.
 * @copyright 2018-2020 Frederic Rezeau, aka 오경진.
 * @copyright 2018-2020 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

(function (namespace) {
    "use strict";

    /**
     * UI canvas element.
     * @class Element
     * @memberof Litemint.Pepper
     */
    namespace.Pepper.Element = function () {
        if (!(this instanceof namespace.Pepper.Element)) {
            throw new Error("ctor error");
        }

        this.vx = 0; // Velocity x.
        this.vy = 0; // Velocity y.
        this.scaleSpeed = 1; // Scale Speed.
        this.rotationSpeed = Math.PI; // Rotation Speed.
        this.scale = 1; // Scale factor.
        this.targetScale = 1; // Target Scale factor.
        this.angle = 0; // Current angle.
        this.targetAngle = 0; // Target angle.
        this.heartBeats = []; // Heartbeats collection.
    };

    // Update the Element time-based properties.
    namespace.Pepper.Element.prototype.update = function (elapsed) {
        const len = this.heartBeats.length;
        for (let i = 0; i < len; i+=1) {
            const heartbeat = this.heartBeats[i];
            if (heartbeat.direction === 0 && heartbeat.time <= heartbeat.maxTime) {
                heartbeat.time = Math.min(heartbeat.time + elapsed * heartbeat.speed1, heartbeat.maxTime);
                if (heartbeat.time === heartbeat.maxTime) {
                    heartbeat.direction = 1;
                }
            }
            else if (heartbeat.direction === 1 && heartbeat.time >= 0) {
                heartbeat.time = Math.max(heartbeat.time - elapsed * heartbeat.speed2, 0);
                if (heartbeat.time === 0) {
                    heartbeat.direction = 0;
                    if (heartbeat.event) {
                        heartbeat.event();
                    }
                }
            }
        }

        if (this.scale > this.targetScale) {
            this.scale -= this.scaleSpeed * elapsed;
            if (this.scale < this.targetScale) {
                this.scale = this.targetScale;
            }
        }
        else if (this.scale < this.targetScale) {
            this.scale += this.scaleSpeed * elapsed;
            if (this.scale > this.targetScale) {
                this.scale = this.targetScale;
            }
        }

        if (this.angle > this.targetAngle) {
            this.angle -= this.rotationSpeed * elapsed;
            if (this.angle < this.targetAngle) {
                this.angle = this.targetAngle;
            }
        }
        else if (this.angle < this.targetAngle) {
            this.angle += this.rotationSpeed * elapsed;
            if (this.angle > this.targetAngle) {
                this.angle = this.targetAngle;
            }
        }
    };

    // Add a new heartbeat object to collection.
    namespace.Pepper.Element.prototype.addHeartBeat = function (time, direction, maxTime, speed1, speed2, event) {
        this.heartBeats.push({
            "time": time,
            "direction": direction,
            "maxTime": maxTime,
            "speed1": speed1,
            "speed2": speed2,
            "event": event
        });
    };

    /**
     * UI canvas HUD element.
     * @class HudElement
     * @param {Number} id Element Id.
     * @memberof Litemint.Pepper
     */
    namespace.Pepper.HudElement = function (id) {
        if (!(this instanceof namespace.Pepper.HudElement)) {
            throw new Error("ctor error");
        }

        namespace.Pepper.Element.call(this);

        this.id = id;
        this.x = 0;
        this.y = 0;
        this.tx = 0;
        this.ty = 0;
        this.width = 0;
        this.height = 0;
        this.speed = 2;
        this.mirror = false;
        this.selected = false;
        this.hover = false;
        this.selectTime = 0;
        this.spawned = true;
        this.perpetualAngle = 0;
        this.enabled = true;
        this.addHeartBeat(0, 0, 1, 9, 9);
    };

    // Setup the HudElement prototype chain.
    namespace.Pepper.HudElement.prototype = Object.create(namespace.Pepper.Element.prototype);

    // Update the HudElement time-based properties.
    namespace.Pepper.HudElement.prototype.update = function (elapsed) {
        let needRedraw = false;
        let dockIt = true;
        const distance = namespace.Pepper.Tools.distance(this.x, this.y, this.tx, this.ty);
        if (distance > this.width * 0.001) {
            this.vx = (this.tx - this.x) / distance * this.speed * distance * 2;
            this.vy = (this.ty - this.y) / distance * this.speed * distance * 2;
            this.x += this.vx * elapsed;
            this.y += this.vy * elapsed;
            if (namespace.Pepper.Tools.distance(this.x, this.y, this.tx, this.ty) < distance) {
                dockIt = false;
            }
            needRedraw = true;
        }

        if (dockIt) {
            this.vx = 0;
            this.vy = 0;
            this.x = this.tx;
            this.y = this.ty;
        }

        if (this.selectTime > 0) {
            this.selectTime -= elapsed;
            if (this.selectTime < 0) {
                this.selectTime = 0;
            }
            needRedraw = true;
        }

        this.perpetualAngle = (this.perpetualAngle + this.rotationSpeed * elapsed) % (Math.PI * 2);

        namespace.Pepper.Element.prototype.update.call(this, elapsed);
        return needRedraw;
    };

    // Create a scroll element object.
    namespace.Pepper.createScrollElement = function () {
       return {
           "x": 0,
           "y": 0,
           "width": 0,
           "height": 0,
           "rowHeight": 0,
           "headerHeight": 0,
           "offset": 0,
           "maxOffset": 0,
           "minOffset": 0,
           "isDown": false,
           "downTime": 0,
           "downDistance": 0,
           "items": [],
           "active": 0,
           "startTime": 0.5
        };
    };

})(window.Litemint = window.Litemint || {});
