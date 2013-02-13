/*global require, console, QUnit, phantom */

function ISODateString(d) {
    "use strict";
    function pad(n) {
        return n < 10 ? '0' + n : n;
    }

    return d.getUTCFullYear() + '-' +
        pad(d.getUTCMonth() + 1) + '-' +
        pad(d.getUTCDate()) + 'T' +
        pad(d.getUTCHours()) + ':' +
        pad(d.getUTCMinutes()) + ':' +
        pad(d.getUTCSeconds()) + 'Z';
}

function XmlWriter(settings) {
    "use strict";
    var lineBreakAt, data, stack;

    function addLineBreak(name) {
        if (lineBreakAt[name] && data[data.length - 1] !== '\n') {
            data.push('\n');
        }
    }

    function makeMap(items, delim, map) {
        var i;

        items = items || [];

        if (typeof (items) === "string") {
            items = items.split(',');
        }

        map = map || {};

        i = items.length;
        while (i--) {
            map[items[i]] = {};
        }

        return map;
    }

    function encode(text) {
        var baseEntities = {
            '"' : '&quot;',
            "'" : '&apos;',
            '<' : '&lt;',
            '>' : '&gt;',
            '&' : '&amp;'
        };

        return ('' + text).replace(/[<>&\"\']/g, function (chr) {
            return baseEntities[chr] || chr;
        });
    }

    data = [];
    stack = [];

    settings = settings || {};
    lineBreakAt = makeMap(settings.linebreak_at || 'mytag');

    this.start = function (name, attrs, empty) {
        var aname;

        if (!empty) {
            stack.push(name);
        }

        data.push('<', name);

        for (aname in attrs) {
            if (attrs.hasOwnProperty(aname)) {
                data.push(" " + encode(aname), '="', encode(attrs[aname]), '"');
            }
        }

        data.push(empty ? ' />' : '>');
        addLineBreak(name);
    };

    this.end = function (name) {
        stack.pop();
        addLineBreak(name);
        data.push('</', name, '>');
        addLineBreak(name);
    };

    this.text = function (text) {
        data.push(encode(text));
    };

    this.cdata = function (text) {
        data.push('<![CDATA[', text, ']]>');
    };

    this.comment = function (text) {
        data.push('<!--', text, '-->');
    };

    this.pi = function (name, text) {
        if (text) {
            data.push('<?', name, ' ', text, '?>\n');
        } else {
            data.push('<?', name, '?>\n');
        }
    };

    this.doctype = function (text) {
        data.push('<!DOCTYPE', text, '>\n');
    };

    this.getString = function () {
        var i;

        for (i = stack.length - 1; i >= 0; i--) {
            this.end(stack[i]);
        }

        stack = [];

        return data.join('').replace(/\n$/, '');
    };

    this.reset = function () {
        data = [];
        stack = [];
    };

    this.pi(settings.xmldecl || 'xml version="1.0" encoding="UTF-8"');
}

function TestRun(settings) {
    "use strict";
    this.url = settings.url;
    this.page = null;
    this.running = false;
}

TestRun.prototype = {
    run: function () {
        "use strict";
        var page = require('webpage').create(),
            that = this;

        this.page = page;
        this.running = true;

        page.onConsoleMessage = function (msg) {
            console.log(msg);
        };

        page.onInitialized = function () {
            page.evaluate(function () {
                window.document.addEventListener('DOMContentLoaded', function () {
                    var currentSuite, currentTest, suites = [], assertCount, start, results = {failed: 0, passed: 0, total: 0, time: 0};
                    window.qunitRunning = true;
                    QUnit.moduleStart(function (data) {
                        currentSuite = {
                            name: data.name,
                            tests: [],
                            failures: 0,
                            time: 0,
                            stdout : '',
                            stderr : ''
                        };
                        suites.push(currentSuite);
                    });

                    QUnit.moduleDone(function (data) {
                    });

                    QUnit.testStart(function (data) {
                        if (!start) { start = new Date(); }

                        assertCount = 0;

                        currentTest = {
                            name: data.name,
                            failures: [],
                            start: new Date()
                        };

                        // Setup default suite if no module was specified
                        if (!currentSuite) {
                            currentSuite = {
                                name: "default",
                                tests: [],
                                failures: 0,
                                time: 0,
                                stdout : '',
                                stderr : ''
                            };

                            suites.push(currentSuite);
                        }

                        currentSuite.tests.push(currentTest);
                    });

                    QUnit.testDone(function (data) {
                        currentTest.failed = data.failed;
                        currentTest.total = data.total;
                        currentSuite.failures += data.failed;

                        results.failed += data.failed;
                        results.passed += data.passed;
                        results.total += data.total;
                    });

                    QUnit.log(function (data) {
                        assertCount += 1;

                        if (!data.result) {
                            currentTest.failures.push(data.message);

                            // Add log message of failure to make it easier to find in jenkins UI
                            currentSuite.stdout += '[' + currentSuite.name + ', ' + currentTest.name + ', ' + assertCount + '] ' + data.message + '\n';
                        }
                    });

                    QUnit.done(function (data) {
                        window.qunitRunning = false;
                        window.quinitSuite = suites;
                    });
                });
            });
        };

        page.open(this.url, function (status) {
            var interval;

            if (status !== "success") {
                console.log('ERROR occured');
                that.running = false;
            } else {
                interval = setInterval(function () {
                    if (!that.isQunitRunning()) {
                        clearInterval(interval);
                        that.running = false;
                    }
                }, 500);
            }
        });
    },
    isQunitRunning: function () {
        "use strict";
        return this.page.evaluate(function () {
            return !!window.qunitDone;
        });
    },
    isRunning: function () {
        "use strict";
        return this.running;
    },
    getQunitResults: function () {
        "use strict";
        var suite = this.page.evaluate(function () {
            return JSON.stringify(window.quinitSuite);
        });
        return JSON.parse(suite);
    }
};


function TestsRunner(urls) {
    "use strict";
    this.urls = urls;
    this.runs = [];
    this.currentRunIndex = -1;
}

TestsRunner.prototype = {
    run: function () {
        "use strict";
        this.runs = [];
        this.currentRunIndex = -1;
        this.startNextRun();
    },
    startNextRun: function () {
        "use strict";
        var url,
            testRun;
        this.currentRunIndex += 1;

        if (this.urls.hasOwnProperty(this.currentRunIndex)) {
            url = this.urls[this.currentRunIndex];
            testRun = new TestRun({'url' : url});
            this.runs.push(testRun);
            testRun.run();
            this.checkRuns();
        } else {
            this.createJunitOutput();
            phantom.exit();
        }

    },

    checkRuns: function () {
        "use strict";
        var that = this,
            interval,
            runningCount = this.runs.length;

        interval = setInterval(function () {
            var index;
            for (index in that.runs) {
                if (that.runs.hasOwnProperty(index)) {
                    if (!that.runs[index].isRunning()) {
                        runningCount = runningCount - 1;
                    }
                }
            }
            if (runningCount <= 0) {
                clearInterval(interval);
                that.startNextRun();
            }
        }, 500);
    },
    createJunitOutput: function () {
        "use strict";
        // Generate XML report
        var index,
            xmlWriter = new XmlWriter({
                linebreak_at : "testsuites,testsuite,testcase,failure,system-out,system-err"
            }),
            now = new Date(),
            i,
            ti,
            fi,
            test,
            suite,
            suites,
            globalstats = {failures: 0, tests: 0, time: 0};

        xmlWriter.start('testsuites');


        for (index in this.runs) {
            if (this.runs.hasOwnProperty(index)) {
                suites = this.runs[index].getQunitResults();
                if (suites) {
                    for (i = 0; i < suites.length; i += 1) {
                        suite = suites[i];

                        // Calculate time
                        for (ti = 0; ti < suite.tests.length; ti += 1) {
                            test = suite.tests[ti];
                            test.time = (now.getTime() - new Date(test.start).getTime()) / 1000;
                            suite.time += test.time;
                        }

                        globalstats.failures += suite.failures;
                        globalstats.tests += suite.tests.length;
                        globalstats.time += Math.round(suite.time * 1000) / 1000;
                    }
                }
            }
        }

        xmlWriter.start('testsuite', {
            name: 'QUnit tests',
            errors: "0",
            failures: globalstats.failures,
            hostname: "localhost",
            tests: globalstats.tests,
            time: globalstats.time
        });

        for (index in this.runs) {
            if (this.runs.hasOwnProperty(index)) {
                suites = this.runs[index].getQunitResults();

                for (i = 0; i < suites.length; i += 1) {
                    suite = suites[i];

                    // Calculate time
                    for (ti = 0; ti < suite.tests.length; ti += 1) {
                        test = suite.tests[ti];
                        test.time = (now.getTime() - new Date(test.start).getTime()) / 1000;
                        suite.time += test.time;
                    }

                    xmlWriter.start('testsuite', {
                        name: suite.name,
                        errors: "0",
                        failures: suite.failures,
                        hostname: "localhost",
                        tests: suite.tests.length,
                        time: Math.round(suite.time * 1000) / 1000,
                        timestamp: ISODateString(now)
                    });

                    for (ti = 0; ti < suite.tests.length; ti += 1) {
                        test = suite.tests[ti];

                        xmlWriter.start('testcase', {
                            name: test.name,
                            total: test.total,
                            failed: test.failed,
                            time: Math.round(test.time * 1000) / 1000
                        });

                        for (fi = 0; fi < test.failures.length; fi += 1) {
                            xmlWriter.start('failure', {type: "AssertionFailedError", message: test.failures[fi]}, true);
                        }

                        xmlWriter.end('testcase');
                    }

                    if (suite.stdout) {
                        xmlWriter.start('system-out');
                        xmlWriter.cdata('\n' + suite.stdout);
                        xmlWriter.end('system-out');
                    }

                    if (suite.stderr) {
                        xmlWriter.start('system-err');
                        xmlWriter.cdata('\n' + suite.stderr);
                        xmlWriter.end('system-err');
                    }

                    xmlWriter.end('testsuite');
                }
            }
        }

        xmlWriter.end('testsuite');

        xmlWriter.end('testsuites');
        console.log(xmlWriter.getString());
    }
};



var tr = new TestsRunner(phantom.args);
tr.run();