/*
 * Copyright (c) 2015 Samsung Electronics Co., Ltd. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* global define, console, window, tizen */

/**
 * Heart Rate Monitor module.
 *
 * @module models/heartRate
 * @requires {@link core/event}
 * @requires {@link core/storage/idb}
 * @namespace models/heartRate
 * @memberof models/heartRate
 */

define({
    name: 'models/heartRate',
    requires: [
        'core/event',
        'core/storage/idb'
    ],
    def: function modelsHeartRate(req) {
        'use strict';

        /**
         * Core storage idb module object.
         *
         * @memberof models/heartRate
         * @private
         * @type {Module}
         */
        var indexedDB = req.core.storage.idb,

            /**
             * Core event module object.
             *
             * @memberof models/heartRate
             * @private
             * @type {Module}
             */
            event = req.core.event,

            /**
             * Specifies the human activity monitor type.
             *
             * @memberof models/heartRate
             * @private
             * @const {string}
             */
            CONTEXT_TYPE = 'HRM',

            /**
             * Specifies the set limit key in storage.
             *
             * @memberof models/heartRate
             * @private
             * @const{string}
             */
            STORAGE_IDB_KEY = 'limit',

            /**
             * Value of current heart rate.
             *
             * @memberof models/heartRate
             * @private
             * @type {object}
             */
            heartRate = null,

            /**
             * Object represents Heart Rate Monitor data.
             *
             * @memberof models/heartRate
             * @private
             * @type {object}
             */
            heartRateData = {},

            FREQUENCY = 1500,
            TEST_TYPE = 'null',
            EFFORT = 1,
            POISSON = 1,
            PE_OR_PO = 'periodic';


        /**
         * Sets heart rate and time values received from sensor.
         * Returns heart rate data.
         *
         * @memberof models/heartRate
         * @private
         * @param {object} heartRateInfo
         * @returns {object}
         */
        function setHeartRateData(heartRateInfo) {
            var pData = {
                rate: heartRateInfo.heartRate,
                rrinterval: heartRateInfo.rRInterval
            };

            heartRateData = pData;
            return pData;
        }

        /**
         * Returns last received motion data.
         *
         * @memberof models/heartRate
         * @private
         * @returns {object}
         */
        function getData() {
            return heartRateData;
        }

        /**
         * Resets heart rate data.
         *
         * @memberof models/heartRate
         * @private
         */
        function resetData() {
            heartRateData = {
                rate: '-',
                rrinterval: '-'
            };
        }

        /**
         * Handles change event on current heart rate.
         *
         * @memberof models/heartRate
         * @private
         * @param {object} heartRateInfo
         * @fires models.heartRate.change
         */
        function handleHeartRateInfo(heartRateInfo) {
            setHeartRateData(heartRateInfo);
            event.fire('change', getData());
        }

        /**
         * Starts the sensor and registers a change listener.
         *
         * @memberof models/heartRate
         * @public
         */
        function start() {
            resetData();
            tizen.power.request('SCREEN', 'SCREEN_NORMAL');
            tizen.power.request('CPU', 'CPU_AWAKE');

            let init;
            let time, model;
            var client = new Paho.MQTT.Client('192.168.1.70', 3000, "web_" + parseInt(Math.random() * 100, 10));
            client.onConnectionLost = onConnectionLost;
            client.onMessageArrived = onMessageArrived;

            const threshold = 0.75;
            toxicity.load(threshold).then(modell => {
//            	alert('Model Loaded');
                model = modell;
            });
            // connect the client
            client.connect({ onSuccess: onConnect });
            var m_battery = {};
            var m_cpu = {};
            var input_word = "unknown", output_word = "unknown", predic_time = 0, lock = 0;
            function predictWord(input) {
                console.log('Hello there');
//                alert('Init here' + init);
                model.classify(input).then(predictions => {
                    predic_time = new Date() - init;
                    console.log(predictions);
                    //                        alert(predictions.length);
                    for (var i = 0; i < predictions.length; i++) {
                        if (predictions[i].results[0].match == true) {
                            output_word = predictions[i].label;
                            break;
                        }
                    }
                    if (TEST_TYPE == 'text_local') {
                        tizen.systeminfo.getPropertyValue('BATTERY', function (battery) {
                            //                        		  console.log(properties);
                            tizen.systeminfo.getPropertyValue('CPU', function (cpu) {
                                init = new Date();
                                time = new Date().getTime();
                                m_battery = Object.assign(battery);
                                m_cpu = Object.assign(cpu);
                                var message = new Paho.MQTT.Message(JSON.stringify({
                                    output_word: output_word,
                                    input_word: input_word,
                                    predic_time: predic_time,
                                    battery: battery,
                                    cpuLoad: cpu,
                                    totalMemory: tizen.systeminfo.getTotalMemory(),
                                    av_Mem: tizen.systeminfo.getAvailableMemory()
                                }));
                                message.destinationName = "watch1/audiodata";
                                client.send(message);
                                //                                      alert('Message sent');
                                lock = 0;
                            });

                        });
                    }

                });
            }
            // called when the client connects
            function onConnect() {
                // Once a connection has been made, make a subscription and send a message.
                console.log("onConnect");
                client.subscribe("watch1/ack");
                client.subscribe("watch1/start");
                client.subscribe("watch1/kill");
                var message = new Paho.MQTT.Message("Watch ready!");
                message.destinationName = "watch1/connect";
                client.send(message);
            }

            // called when the client loses its connection
            function onConnectionLost(responseObject) {
                if (responseObject.errorCode !== 0) {
                    console.log("onConnectionLost:" + responseObject.errorMessage);
                }
            }
            function getRandomInt(max) {
                return Math.floor(Math.random() * Math.floor(max));
            }
            var sentences = ['you suck', 'you are a fool', 'what an idiot', 'go to hell'];
            // called when a message arrives
            function onMessageArrived(message) {
                console.log('Message Received' + message);
                if (message.destinationName == 'watch1/start') {
                    //            		alert('Received message to start..');

                    var msg = JSON.parse(message.payloadString);

                    FREQUENCY = msg.frequency * 60 * 1000;
                    //            		alert(FREQUENCY);
                    TEST_TYPE = msg.test_type;
                    //            		alert(TEST_TYPE);
                    EFFORT = msg.effort;
                    //            		alert(EFFORT);
                    PE_OR_PO = msg.pe_or_po;
                    //            		alert(PE_OR_PO);
                    POISSON = msg.poisson * 60 * 1000;
                    //            		alert(POISSON);
                    if (TEST_TYPE == 'text_local' && PE_OR_PO == 'periodic') {
                        //            			alert('In');
                        setInterval(() => {
                            //                        	alert('In the interval');
                            var sentence_no = getRandomInt(4);
                            input_word = sentences[sentence_no];
                            //                        	alert(input_word);
                            init = new Date();
                            predictWord(input_word);
                        }, FREQUENCY);
                    } else if (msg.test_type == 'text_local' && PE_OR_PO == 'poisson') {
                        //            			alert('POISSON RUN NOW: ' + POISSON);
                        var check_interval = setTimeout(() => {
                            var sentence_no = getRandomInt(4);
                            input_word = sentences[sentence_no];
                            init = new Date();
                            //                      	  alert(input_word);
                            predictWord(input_word);
                        }, POISSON * 2);
                        var p = poissonProcess.create(POISSON, function message() {
                            if (lock == 0) {
                                clearTimeout(check_interval);
                                check_interval = setTimeout(() => {
                                    var sentence_no = getRandomInt(4);
                                    input_word = sentences[sentence_no];
                                    init = new Date();
                                    //                              	  alert(input_word);
                                    predictWord(input_word);
                                }, POISSON * 2);
                                lock = 1;
                                console.log('A message arrived.');
                                var sentence_no = getRandomInt(4);
                                input_word = sentences[sentence_no];
                                init = new Date();
                                //                              	  alert(input_word);
                                predictWord(input_word);
                            }
                        });
                        p.start()

                    } else if (msg.test_type == 'text_offload') {
                        client.subscribe("textdata/inferred");
                        if (PE_OR_PO == 'poisson') {
                            var check_interval = setTimeout(() => {
                            	if(lock == 0){
//                            		alert('In 1');
                                    lock = 1;
                                    var sentence_no = getRandomInt(4);
                                    input_word = sentences[sentence_no];
                                    init = new Date();
                                    var message = new Paho.MQTT.Message(JSON.stringify({
                                        input_word: input_word
                                    }));
                                    message.destinationName = "watch1/textdata";
                                    client.send(message);
                            	}

                            }, POISSON * 2);
                            var p = poissonProcess.create(POISSON, function message() {
                                if (lock == 0) {
//                                	alert('In main');
                                    clearTimeout(check_interval);
                                    check_interval = setTimeout(() => {
                                    	if(lock == 0){
//                                    		alert('In 2');
                                            lock = 1;
                                            var sentence_no = getRandomInt(4);
                                            input_word = sentences[sentence_no];
                                            init = new Date();
                                            var message = new Paho.MQTT.Message(JSON.stringify({
                                                input_word: input_word
                                            }));
                                            message.destinationName = "watch1/textdata";
                                            client.send(message);
                                    	}
 
                                    }, POISSON * 2);
                                    lock = 1;
                                    console.log('A message arrived.');
                                    var sentence_no = getRandomInt(4);
                                    input_word = sentences[sentence_no];
                                    init = new Date();
                                    var message = new Paho.MQTT.Message(JSON.stringify({
                                        input_word: input_word
                                    }));
                                    message.destinationName = "watch1/textdata";
                                    client.send(message);
                                }
                            });
                            p.start()
                        } else {
                            setInterval(() => {
                                var sentence_no = getRandomInt(4);
                                input_word = sentences[sentence_no];
                                init = new Date();
                                var message = new Paho.MQTT.Message(JSON.stringify({
                                    input_word: input_word
                                }));
                                message.destinationName = "watch1/textdata";
                                client.send(message);
                                console.log('Message sent');
                            }, FREQUENCY);
                        }

                    } 
                } else if (message.destinationName == "textdata/inferred") {
                    
                    predic_time = new Date() - init;
                    var msg = JSON.parse(message.payloadString);
                    output_word = msg.output_word;
                    tizen.systeminfo.getPropertyValue('BATTERY', function (battery) {
                        //                    		  console.log(properties);
                        tizen.systeminfo.getPropertyValue('CPU', function (cpu) {
                            m_battery = Object.assign(battery);
                            m_cpu = Object.assign(cpu);
                            var message = new Paho.MQTT.Message(JSON.stringify({
                                output_word: output_word,
                                input_word: input_word,
                                predic_time: predic_time,
                                battery: battery,
                                cpuLoad: cpu,
                                totalMemory: tizen.systeminfo.getTotalMemory(),
                                av_Mem: tizen.systeminfo.getAvailableMemory()
                            }));
                            message.destinationName = "watch1/audiodata";
                            client.send(message);
                            input_word = "unknown";
                            output_word = "unknown";
                            lock = 0;
                        });

                    });
                }
                else if (message.destinationName == "watch1/ack") {
                    var finaldate = new Date() - init;
                    console.log("FINAL DATE:" + finaldate);
                    console.log("Message from server:" + message.payloadString);
                    var message = new Paho.MQTT.Message(JSON.stringify({
                        hrm: heartRateData.rate,
                        time: time,
                        battery: m_battery,
                        cpuLoad: m_cpu,
                        totalMemory: tizen.systeminfo.getTotalMemory(),
                        av_Mem: tizen.systeminfo.getAvailableMemory(),
                        roundtrip_time: finaldate
                    }));
                    message.destinationName = "watch1/finaldata";
                    client.send(message);
                    console.log('Message sent');
                }
                else if (message.destinationName == "watch1/kill") {
                    tizen.application.getCurrentApplication().exit();
                }
            }








            //            
            //            heartRate.start(
            //                CONTEXT_TYPE,
            //                function onSuccess(heartRateInfo) {
            //                    handleHeartRateInfo(heartRateInfo);
            //                },
            //                function onError(error) {
            //                    console.log('error: ', error.message);
            //                }
            //            );
        }

        /**
         * Stops the sensor and unregisters a previously registered listener.
         *
         * @memberof models/heartRate
         * @public
         */
        function stop() {
            heartRate.stop(CONTEXT_TYPE);
        }

        /**
         * Reads limit value from storage, what fires 'core.storage.idb.read'.
         *
         * @memberof models/heartRate
         * @public
         */
        function getLimit() {
            indexedDB.get(STORAGE_IDB_KEY);
        }

        /**
         * Sets limit value in storage.
         *
         * @memberof models/heartRate
         * @public
         * @param {object} value
         */
        function setLimit(value) {
            indexedDB.set(STORAGE_IDB_KEY, value);
        }

        /**
         * Handles 'core.storage.idb.write' event.
         *
         * @memberof models/heartRate
         * @private
         * @fires models.heartRate.setLimit
         */
        function onWriteLimit() {
            event.fire('setLimit');
        }

        /**
         * Handles 'core.storage.idb.read' event.
         *
         * @memberof models/heartRate
         * @private
         * @param {Event} e
         * @fires models.heartRate.getLimit
         */
        function onReadLimit(e) {
            event.fire('getLimit', e);
        }

        /**
         * Registers event listeners.
         *
         * @memberof models/heartRate
         * @private
         */
        function bindEvents() {

            event.on({
                'core.storage.idb.write': onWriteLimit,
                'core.storage.idb.read': onReadLimit
            });
        }

        /**
         * Initializes the module.
         *
         * @memberof models/heartRate
         * @public
         */
        function init() {
            bindEvents();
            resetData();
            if (indexedDB.isReady()) {
                getLimit();
            } else {
                event.listen('core.storage.idb.open', getLimit);
            }

            heartRate = (tizen && tizen.humanactivitymonitor) ||
                (window.webapis && window.webapis.motion) || null;
        }

        return {
            init: init,
            start: start,
            stop: stop,
            getLimit: getLimit,
            setLimit: setLimit
        };
    }
});
