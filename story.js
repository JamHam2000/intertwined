// Created with Squiffy 5.1.2
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '5445985680';
squiffy.story.sections = {
	'_default': {
		'text': "<p>A sailor is standing in front of you, motionless. In one hand, the sailor is offering you a <a class=\"squiffy-link link-section\" data-section=\"bundle of rope\" role=\"link\" tabindex=\"0\">bundle of rope</a>. In the other, a <a class=\"squiffy-link link-section\" data-section=\"cough sweet\" role=\"link\" tabindex=\"0\">cough sweet</a>. Which do you take?</p>",
		'passages': {
		},
	},
	'bundle of rope': {
		'text': "<p>You take the bundle of rope. It is knotted at both ends. </p>\n<p>You are in a fishmongers in front of a fish. <a class=\"squiffy-link link-section\" data-section=\"Behead the Fish\" role=\"link\" tabindex=\"0\">Behead the Fish</a> or <a class=\"squiffy-link link-section\" data-section=\"Fillet the Fish\" role=\"link\" tabindex=\"0\">Fillet the Fish</a>?</p>",
		'passages': {
		},
	},
	'Behead the Fish': {
		'text': "<p>The fish is rubber.</p>\n<p>You&#39;re in prison. <a class=\"squiffy-link link-section\" data-section=\"Break Out\" role=\"link\" tabindex=\"0\">Break Out</a> or <a class=\"squiffy-link link-section\" data-section=\"Confess\" role=\"link\" tabindex=\"0\">Confess</a>?</p>",
		'passages': {
		},
	},
	'Break Out': {
		'text': "<p>Your acne is worse than ever before.</p>\n<p>You&#39;re in a band. <a class=\"squiffy-link link-section\" data-section=\"Play the Trumpet\" role=\"link\" tabindex=\"0\">Play the Trumpet</a> or <a class=\"squiffy-link link-section\" data-section=\"Don't\" role=\"link\" tabindex=\"0\">Don&#39;t</a>?</p>",
		'passages': {
		},
	},
	'Confess': {
		'text': "<p>10 Hail Mary&#39;s.</p>\n<p>You&#39;re a joke shop owner. <a class=\"squiffy-link link-section\" data-section=\"Stock the Rubber Animals\" role=\"link\" tabindex=\"0\">Stock the Rubber Animals</a> or <a class=\"squiffy-link link-section\" data-section=\"Run Away to the Hills\" role=\"link\" tabindex=\"0\">Run Away to the Hills</a>?</p>",
		'passages': {
		},
	},
	'Stock the Rubber Animals': {
		'text': "<p>Squeak.</p>\n<p>You&#39;re an arsonist. <a class=\"squiffy-link link-section\" data-section=\"Start a Fire\" role=\"link\" tabindex=\"0\">Start a Fire</a> or <a class=\"squiffy-link link-section\" data-section=\"Arse on What?\" role=\"link\" tabindex=\"0\">Arse on What?</a></p>",
		'passages': {
		},
	},
	'Arse on What?': {
		'text': "<p>You&#39;ve been charged with indecent exposure. Again.</p>\n<p>You&#39;ve escaped a bear. Where to? <a class=\"squiffy-link link-section\" data-section=\"Barcelona\" role=\"link\" tabindex=\"0\">Barcelona</a> or <a class=\"squiffy-link link-section\" data-section=\"Devon\" role=\"link\" tabindex=\"0\">Devon</a>?</p>",
		'passages': {
		},
	},
	'Start a Fire': {
		'text': "<p>You set a building on fire, you monster.</p>\n<p>You get tasered by a lunatic police officer. <a class=\"squiffy-link link-section\" data-section=\"Twitch\" role=\"link\" tabindex=\"0\">Twitch</a> or <a class=\"squiffy-link link-section\" data-section=\"Twitch Some More\" role=\"link\" tabindex=\"0\">Twitch Some More</a>?</p>",
		'passages': {
		},
	},
	'Run Away to the Hills': {
		'text': "<p>You start burrowing.</p>\n<p>You&#39;re a doctor. <a class=\"squiffy-link link-section\" data-section=\"Diagnose a Common Cold\" role=\"link\" tabindex=\"0\">Diagnose a Common Cold</a> or <a class=\"squiffy-link link-section\" data-section=\"TARDIS\" role=\"link\" tabindex=\"0\">TARDIS</a>?</p>",
		'passages': {
		},
	},
	'Fillet the Fish': {
		'text': "<p>Your contract is terminated.</p>\n<p>You&#39;re in theatre. <a class=\"squiffy-link link-section\" data-section=\"Sing the Final Musical Number\" role=\"link\" tabindex=\"0\">Sing the Final Musical Number</a> or <a class=\"squiffy-link link-section\" data-section=\"Make the First Incision\" role=\"link\" tabindex=\"0\">Make the First Incision</a>?</p>",
		'passages': {
		},
	},
	'Make the First Incision': {
		'text': "<p>Your fellow actor heamorrhages.</p>\n<p>You&#39;re a zookeeper. <a class=\"squiffy-link link-section\" data-section=\"Release the Bear\" role=\"link\" tabindex=\"0\">Release the Bear</a> or <a class=\"squiffy-link link-section\" data-section=\"Release the Lion\" role=\"link\" tabindex=\"0\">Release the Lion</a>?</p>",
		'passages': {
		},
	},
	'Release the Bear': {
		'text': "<p>The bear wanders off.</p>\n<p>You&#39;re strangling a man with rope. <a class=\"squiffy-link link-section\" data-section=\"Pull Tighter\" role=\"link\" tabindex=\"0\">Pull Tighter</a> or <a class=\"squiffy-link link-section\" data-section=\"Stop and Apologise\" role=\"link\" tabindex=\"0\">Stop and Apologise</a>?</p>",
		'passages': {
		},
	},
	'Sing the Final Musical Number': {
		'text': "<p>You&#39;re barred from practicing as a doctor.</p>\n<p>The garden needs weeding. <a class=\"squiffy-link link-section\" data-section=\"Weed it\" role=\"link\" tabindex=\"0\">Weed it</a> or <a class=\"squiffy-link link-section\" data-section=\"Feed it\" role=\"link\" tabindex=\"0\">Feed it</a>?</p>",
		'passages': {
		},
	},
	'Feed it': {
		'text': "<p>It&#39;s not hungry.</p>\n<p>The smoke alarm is going off. <a class=\"squiffy-link link-section\" data-section=\"Evacuate\" role=\"link\" tabindex=\"0\">Evacuate</a> or <a class=\"squiffy-link link-section\" data-section=\"Probably a False Alarm\" role=\"link\" tabindex=\"0\">Probably a False Alarm</a>?</p>",
		'passages': {
		},
	},
	'Weed it': {
		'text': "<p>You&#39;re arrested for indecent exposure.</p>\n<p>You&#39;re captaining a ship. <a class=\"squiffy-link link-section\" data-section=\"Friendship\" role=\"link\" tabindex=\"0\">Friendship</a> or <a class=\"squiffy-link link-section\" data-section=\"Iceberg\" role=\"link\" tabindex=\"0\">Iceberg</a>?</p>",
		'passages': {
		},
	},
	'cough sweet': {
		'text': "<p>You take the cough sweet. It&#39;s not a cough sweet. </p>\n<p>You are in a pottery class while high. <a class=\"squiffy-link link-section\" data-section=\"Make a Vase\" role=\"link\" tabindex=\"0\">Make a Vase</a> or <a class=\"squiffy-link link-section\" data-section=\"Make a Mug\" role=\"link\" tabindex=\"0\">Make a Mug</a>?</p>",
		'passages': {
		},
	},
	'Make a Vase': {
		'text': "<p>You&#39;re bad at pottery. The vase is not good.</p>\n<p>There&#39;s a bear in front of you. <a class=\"squiffy-link link-section\" data-section=\"Kill it\" role=\"link\" tabindex=\"0\">Kill it</a> or <a class=\"squiffy-link link-section\" data-section=\"Tame it\" role=\"link\" tabindex=\"0\">Tame it</a>?</p>",
		'passages': {
		},
	},
	'Kill it': {
		'text': "<p>The bear is not impressed.</p>\n<p>Your boat has been vandalised. <a class=\"squiffy-link link-section\" data-section=\"Call the Police\" role=\"link\" tabindex=\"0\">Call the Police</a> or <a class=\"squiffy-link link-section\" data-section=\"Reassure the Boat\" role=\"link\" tabindex=\"0\">Reassure the Boat</a>?</p>",
		'passages': {
		},
	},
	'Tame it': {
		'text': "<p>The bear is named Jeremy and fights crime for a living.</p>\n<p>You&#39;re a lawyer. The charge is murder. Is your client <a class=\"squiffy-link link-section\" data-section=\"Guilty\" role=\"link\" tabindex=\"0\">Guilty</a> or <a class=\"squiffy-link link-section\" data-section=\"Not Guilty\" role=\"link\" tabindex=\"0\">Not Guilty</a>?</p>",
		'passages': {
		},
	},
	'Guilty': {
		'text': "<p>That&#39;s not how to be a lawyer.</p>\n<p>A shoe shiner shines your shoes. <a class=\"squiffy-link link-section\" data-section=\"Pay the Man\" role=\"link\" tabindex=\"0\">Pay the Man</a> or <a class=\"squiffy-link link-section\" data-section=\"Kick the Man\" role=\"link\" tabindex=\"0\">Kick the Man</a>?</p>",
		'passages': {
		},
	},
	'Kick the Man': {
		'text': "<p>You break his nose with your freshly shined shoe.</p>\n<p>You&#39;re fishing. <a class=\"squiffy-link link-section\" data-section=\"Catch a Fish\" role=\"link\" tabindex=\"0\">Catch a Fish</a> or <a class=\"squiffy-link link-section\" data-section=\"Go Home because Fishing's Shit\" role=\"link\" tabindex=\"0\">Go Home because Fishing&#39;s Shit</a>?</p>",
		'passages': {
		},
	},
	'Pay the Man': {
		'text': "<p>He doesn&#39;t accept Visa.</p>\n<p>You&#39;re in a photo. <a class=\"squiffy-link link-section\" data-section=\"Say Cheese\" role=\"link\" tabindex=\"0\">Say Cheese</a> or <a class=\"squiffy-link link-section\" data-section=\"Eat Cheese\" role=\"link\" tabindex=\"0\">Eat Cheese</a>?</p>",
		'passages': {
		},
	},
	'Say Cheese': {
		'text': "<p>You grin like a lunatic. The wedding picture will forever feature you looking like a moron.</p>\n<p>A man kicks you in the face and breaks your nose. <a class=\"squiffy-link link-section\" data-section=\"Police Report\" role=\"link\" tabindex=\"0\">Police Report</a> or <a class=\"squiffy-link link-section\" data-section=\"Pull Out your Service Weapon\" role=\"link\" tabindex=\"0\">Pull Out your Service Weapon</a>?</p>",
		'passages': {
		},
	},
	'Make a Mug': {
		'text': "<p>The mug is delicious.</p>\n<p>You&#39;re on a date. <a class=\"squiffy-link link-section\" data-section=\"Propose\" role=\"link\" tabindex=\"0\">Propose</a> or <a class=\"squiffy-link link-section\" data-section=\"Get Off the Date\" role=\"link\" tabindex=\"0\">Get Off the Date</a>?</p>",
		'passages': {
		},
	},
	'Get Off the Date': {
		'text': "<p>It&#39;s flat.</p>\n<p>You&#39;re a police officer. <a class=\"squiffy-link link-section\" data-section=\"Pepper Spray\" role=\"link\" tabindex=\"0\">Pepper Spray</a> or <a class=\"squiffy-link link-section\" data-section=\"Taser\" role=\"link\" tabindex=\"0\">Taser</a>?</p>",
		'passages': {
		},
	},
	'Taser': {
		'text': "<p>She gets tased.</p>\n<p>An out of control boat is barreling towards you. <a class=\"squiffy-link link-section\" data-section=\"Jump\" role=\"link\" tabindex=\"0\">Jump</a> or <a class=\"squiffy-link link-section\" data-section=\"Relax, it's Only a Barrel\" role=\"link\" tabindex=\"0\">Relax, it&#39;s Only a Barrel</a>?</p>",
		'passages': {
		},
	},
	'Pepper Spray': {
		'text': "<p>The pepper is wet.</p>\n<p>The wedding has started. <a class=\"squiffy-link link-section\" data-section=\"\"I Do\"\" role=\"link\" tabindex=\"0\">&quot;I Do&quot;</a> or <a class=\"squiffy-link link-section\" data-section=\"\"Do I?\"\" role=\"link\" tabindex=\"0\">&quot;Do I?&quot;</a></p>",
		'passages': {
		},
	},
	'"I Do"': {
		'text': "<p>The wedding continues.</p>\n<p>You&#39;re an iceberg. A ship approaches. <a class=\"squiffy-link link-section\" data-section=\"Shit\" role=\"link\" tabindex=\"0\">Shit</a></p>",
		'passages': {
		},
	},
	'"Do I?"': {
		'text': "<p>You&#39;re informed the wedding cannot continue until you say the vows correctly.</p>\n<p>You&#39;re a badger infantry officer. You spot squirrels on the horizon. <a class=\"squiffy-link link-section\" data-section=\"Sound the Alarm\" role=\"link\" tabindex=\"0\">Sound the Alarm</a> or <a class=\"squiffy-link link-section\" data-section=\"Defend the Bunker Yourself\" role=\"link\" tabindex=\"0\">Defend the Bunker Yourself</a>?</p>",
		'passages': {
		},
	},
	'Shit': {
		'text': "<p>The ship hits you.</p>\n<p>You&#39;re in a joke shop. <a class=\"squiffy-link link-section\" data-section=\"Buy a Rubber Fish\" role=\"link\" tabindex=\"0\">Buy a Rubber Fish</a> or <a class=\"squiffy-link link-section\" data-section=\"Reconsider your Life Decisions\" role=\"link\" tabindex=\"0\">Reconsider your Life Decisions</a>?</p>",
		'passages': {
		},
	},
	'Propose': {
		'text': "<p>The date agrees to marry you.</p>\n<p>You&#39;re on a boat. <a class=\"squiffy-link link-section\" data-section=\"Rock the Boat\" role=\"link\" tabindex=\"0\">Rock the Boat</a> or <a class=\"squiffy-link link-section\" data-section=\"Don't Rock the Boat, Baby\" role=\"link\" tabindex=\"0\">Don&#39;t Rock the Boat, Baby</a>?</p>",
		'passages': {
		},
	},
	'Rock the Boat': {
		'text': "<p>The rock dents the boat.</p>\n<p>You&#39;re a drug dealer. <a class=\"squiffy-link link-section\" data-section=\"Sell the Sailor Drugs\" role=\"link\" tabindex=\"0\">Sell the Sailor Drugs</a> or <a class=\"squiffy-link link-section\" data-section=\"Rebrand Your Coke as Pepsi\" role=\"link\" tabindex=\"0\">Rebrand Your Coke as Pepsi</a>?</p>",
		'passages': {
		},
	},
	'Rebrand Your Coke as Pepsi': {
		'text': "<p>It doesn&#39;t sell as well.</p>\n<p>You&#39;re planning a wedding. <a class=\"squiffy-link link-section\" data-section=\"Blue Flowers\" role=\"link\" tabindex=\"0\">Blue Flowers</a> or <a class=\"squiffy-link link-section\" data-section=\"Gymnastics Routine\" role=\"link\" tabindex=\"0\">Gymnastics Routine</a>?</p>",
		'passages': {
		},
	},
	'Sell the Sailor Drugs': {
		'text': "<p>You told him it was a cough sweet.</p>\n<p>You built a boat. <a class=\"squiffy-link link-section\" data-section=\"Noah\" role=\"link\" tabindex=\"0\">Noah</a> or <a class=\"squiffy-link link-section\" data-section=\"Titanic\" role=\"link\" tabindex=\"0\">Titanic</a>?</p>",
		'passages': {
		},
	},
	'Noah': {
		'text': "<p>No, ah!</p>\n<p>You meet a lion. <a class=\"squiffy-link link-section\" data-section=\"\"Hello!\"\" role=\"link\" tabindex=\"0\">&quot;Hello!&quot;</a> or <a class=\"squiffy-link link-section\" data-section=\"Trample it\" role=\"link\" tabindex=\"0\">Trample it</a>?</p>",
		'passages': {
		},
	},
	'Trample it': {
		'text': "<p>The lion is too large to trample. It tramples you.</p>\n<p>The squirrels torture you for information. <a class=\"squiffy-link link-section\" data-section=\"Deny Everything\" role=\"link\" tabindex=\"0\">Deny Everything</a> or <a class=\"squiffy-link link-section\" data-section=\"Give them What they Want\" role=\"link\" tabindex=\"0\">Give them What they Want</a>?</p>",
		'passages': {
		},
	},
	'"Hello!"': {
		'text': "<p>The lion isn&#39;t in the mood for conversation, and begins dancing.</p>\n<p>Your throat hurts. <a class=\"squiffy-link link-section\" data-section=\"Cough Sweet\" role=\"link\" tabindex=\"0\">Cough Sweet</a> or <a class=\"squiffy-link link-section\" data-section=\"Remove the Rope Around it\" role=\"link\" tabindex=\"0\">Remove the Rope Around it</a>?</p>",
		'passages': {
		},
	},
	'Remove the Rope Around it': {
		'text': "<p>The man strangling you apologises.</p>\n<p>The wedding reception is falling flat. <a class=\"squiffy-link link-section\" data-section=\"Dance Off\" role=\"link\" tabindex=\"0\">Dance Off</a> or <a class=\"squiffy-link link-section\" data-section=\"Speech\" role=\"link\" tabindex=\"0\">Speech</a>?</p>",
		'passages': {
		},
	},
	'Cough Sweet': {
		'text': "<p>Time for pottery class.</p>\n<p>The wildlife rebels and attacks. <a class=\"squiffy-link link-section\" data-section=\"Fight Back\" role=\"link\" tabindex=\"0\">Fight Back</a> or <a class=\"squiffy-link link-section\" data-section=\"Flee. They're too Strong\" role=\"link\" tabindex=\"0\">Flee. They&#39;re too Strong</a>?</p>",
		'passages': {
		},
	},
	'Fight Back': {
		'text': "<p>The squirrels overcome you and carry you away.</p>\n<p>Your cruise ship has collided with an iceberg. <a class=\"squiffy-link link-section\" data-section=\"Swim for it\" role=\"link\" tabindex=\"0\">Swim for it</a> or <a class=\"squiffy-link link-section\" data-section=\"Put it in a Salad\" role=\"link\" tabindex=\"0\">Put it in a Salad</a>?</p>",
		'passages': {
		},
	},
	'Put it in a Salad': {
		'text': "<p>Delicious. Service!</p>\n<p>You&#39;re a lion. A human attempts to talk to you. <a class=\"squiffy-link link-section\" data-section=\"Dance\" role=\"link\" tabindex=\"0\">Dance</a> or <a class=\"squiffy-link link-section\" data-section=\"\"Fuck Off\"\" role=\"link\" tabindex=\"0\">&quot;Fuck Off&quot;</a>?</p>",
		'passages': {
		},
	},
	'Swim for it': {
		'text': "<p>You swim for the iceberg. It remains displeased.</p>\n<p>Your vase falls off the cabinet and shatters. <a class=\"squiffy-link link-section\" data-section=\"Cry\" role=\"link\" tabindex=\"0\">Cry</a> or <a class=\"squiffy-link link-section\" data-section=\"Super Glue\" role=\"link\" tabindex=\"0\">Super Glue</a>?</p>",
		'passages': {
		},
	},
	'Cry': {
		'text': "<p>The vase remains indifferent. And broken.</p>\n<p>A lion tells you to fuck off. <a class=\"squiffy-link link-section\" data-section=\"Become Irate\" role=\"link\" tabindex=\"0\">Become Irate</a> or <a class=\"squiffy-link link-section\" data-section=\"Fuck it Up\" role=\"link\" tabindex=\"0\">Fuck it Up</a>?</p>",
		'passages': {
		},
	},
	'Fuck it Up': {
		'text': "<p>You misread the situation. The lion fucks you up.</p>\n<p>You&#39;re the best man. <a class=\"squiffy-link link-section\" data-section=\"Present the Rings\" role=\"link\" tabindex=\"0\">Present the Rings</a> or <a class=\"squiffy-link link-section\" data-section=\"Present the Presents\" role=\"link\" tabindex=\"0\">Present the Presents</a>?</p>",
		'passages': {
		},
	},
	'Become Irate': {
		'text': "<p>You are mildly irritated by this outburst. The lion doesn&#39;t care.</p>\n<p>You&#39;re a squirrel. War has broken out on your hill. <a class=\"squiffy-link link-section\" data-section=\"Stay and Fight\" role=\"link\" tabindex=\"0\">Stay and Fight</a> or <a class=\"squiffy-link link-section\" data-section=\"Take your Family and Run\" role=\"link\" tabindex=\"0\">Take your Family and Run</a>?</p>",
		'passages': {
		},
	},
	'Super Glue': {
		'text': "<p>You continue to feed your drug habit, looking forward to your meeting with your dealer.</p>\n<p>You are tasked with committing murder. <a class=\"squiffy-link link-section\" data-section=\"Accept\" role=\"link\" tabindex=\"0\">Accept</a> or <a class=\"squiffy-link link-section\" data-section=\"Reluctantly Accept\" role=\"link\" tabindex=\"0\">Reluctantly Accept</a>?</p>",
		'passages': {
		},
	},
	'Titanic': {
		'text': "<p>Just the tip of the iceberg.</p>\n<p>You&#39;re living in the hills. <a class=\"squiffy-link link-section\" data-section=\"Become One With the Wildlife\" role=\"link\" tabindex=\"0\">Become One With the Wildlife</a> or <a class=\"squiffy-link link-section\" data-section=\"Dig your Way Out\" role=\"link\" tabindex=\"0\">Dig your Way Out</a>?</p>",
		'passages': {
		},
	},
	'Become One With the Wildlife': {
		'text': "<p>You join the Badger Resistance, participating in the ongoing war.</p>\n<p>You&#39;re a bank robber being persued by a bear named Jeremy. <a class=\"squiffy-link link-section\" data-section=\"Keep Running\" role=\"link\" tabindex=\"0\">Keep Running</a> or <a class=\"squiffy-link link-section\" data-section=\"Surrender\" role=\"link\" tabindex=\"0\">Surrender</a>?</p>",
		'passages': {
		},
	},
	'Don\'t Rock the Boat, Baby': {
		'text': "<p>You walk calmly away from the boat; your anger in check.</p>\n<p>You&#39;re a sailor. <a class=\"squiffy-link link-section\" data-section=\"Buy the Drugs\" role=\"link\" tabindex=\"0\">Buy the Drugs</a> or <a class=\"squiffy-link link-section\" data-section=\"Buy the Pepsi\" role=\"link\" tabindex=\"0\">Buy the Pepsi</a>?</p>",
		'passages': {
		},
	},
}
})();