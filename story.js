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
	'Don\'t': {
		'text': "<p>Everyone stares at you.</p>\n<p>The Crab King demands a joke. <a class=\"squiffy-link link-section\" data-section=\"Knock Knock\" role=\"link\" tabindex=\"0\">Knock Knock</a> or <a class=\"squiffy-link link-section\" data-section=\"Waiter Waiter\" role=\"link\" tabindex=\"0\">Waiter Waiter</a>?</p>",
		'passages': {
		},
	},
	'Knock Knock': {
		'text': "<p>The Crab King cares not for your joke.</p>\n<p>The trumpet player is bad. <a class=\"squiffy-link link-section\" data-section=\"Applaud Anyway\" role=\"link\" tabindex=\"0\">Applaud Anyway</a> or <a class=\"squiffy-link link-section\" data-section=\"Watch the Embarrassment Consume Them\" role=\"link\" tabindex=\"0\">Watch the Embarrassment Consume Them</a>?</p>",
		'passages': {
		},
	},
	'Applaud Anyway': {
		'text': "<p>You&#39;re the only one clapping. The room is now focussed on you and your terrible social skills.</p>\n<p>You have somewhere to be in twenty minutes. <a class=\"squiffy-link link-section\" data-section=\"Vodka\" role=\"link\" tabindex=\"0\">Vodka</a> or <a class=\"squiffy-link link-section\" data-section=\"Rum\" role=\"link\" tabindex=\"0\">Rum</a>?</p>",
		'passages': {
		},
	},
	'Rum': {
		'text': "<p>Everything someone says to you is hilarious, and you&#39;re telling everyone you&#39;re a pirate.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Vodka': {
		'text': "<p>You&#39;re blackout drunk in the space of 85 seconds. Best get going! Don&#39;t wanna be late!</p>\n<p>The astronaut is hungry. <a class=\"squiffy-link link-section\" data-section=\"Give Gum\" role=\"link\" tabindex=\"0\">Give Gum</a> or <a class=\"squiffy-link link-section\" data-section=\"Eat the Gum in Front of Her\" role=\"link\" tabindex=\"0\">Eat the Gum in Front of Her</a>?</p>",
		'passages': {
		},
	},
	'Give Gum': {
		'text': "<p>The astronaut is allergic.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Eat the Gum in Front of Her': {
		'text': "<p>You slowly eat the gum while making eye contact with the astronaut. You choke on it.</p>\n<p>You&#39;re a high ranking squirrel. <a class=\"squiffy-link link-section\" data-section=\"Launch the Nukes\" role=\"link\" tabindex=\"0\">Launch the Nukes</a> or <a class=\"squiffy-link link-section\" data-section=\"Email the Badgers Proposing a Peace Treaty\" role=\"link\" tabindex=\"0\">Email the Badgers Proposing a Peace Treaty</a>?</p>",
		'passages': {
		},
	},
	'Launch the Nukes': {
		'text': "<p>The nukes are inbound to the squirrel base. T- 58 seconds.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Email the Badgers Proposing a Peace Treaty': {
		'text': "<p>The badgers have yet to respond.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue4': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Watch the Embarrassment Consume Them': {
		'text': "<p>The room sits in silent for 35 minutes while the trumpeter collapses in floods of tears.</p>\n<p>The karaoke bar is rocking out to Journey. <a class=\"squiffy-link link-section\" data-section=\"Join In\" role=\"link\" tabindex=\"0\">Join In</a> or <a class=\"squiffy-link link-section\" data-section=\"Torch the Place\" role=\"link\" tabindex=\"0\">Torch the Place</a>?</p>",
		'passages': {
		},
	},
	'Join In': {
		'text': "<p>You expect it to become like Glee, but it&#39;s just a drunken mess.</p>\n<p>The nukes are inbound. T- 32 seconds. <a class=\"squiffy-link link-section\" data-section=\"Alert the Others\" role=\"link\" tabindex=\"0\">Alert the Others</a> or <a class=\"squiffy-link link-section\" data-section=\"Launch a Counter Attack\" role=\"link\" tabindex=\"0\">Launch a Counter Attack</a>?</p>",
		'passages': {
		},
	},
	'Launch a Counter Attack': {
		'text': "<p>The Dorset countryside is alight with the trails of ballistic missiles.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Alert the Others': {
		'text': "<p>The squirrels are panicked.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue6': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Torch the Place': {
		'text': "<p>The police are searching for a serial arsonist.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue7': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Waiter Waiter': {
		'text': "<p>The waiter stares at you, visibly annoyed at being addressed as such.</p>\n<p>You&#39;re a gymnast in a performance. <a class=\"squiffy-link link-section\" data-section=\"Arabesque\" role=\"link\" tabindex=\"0\">Arabesque</a> or <a class=\"squiffy-link link-section\" data-section=\"Back Flip\" role=\"link\" tabindex=\"0\">Back Flip</a>?</p>",
		'passages': {
		},
	},
	'Arabesque': {
		'text': "<p>Your recent hip replacement was not meant for this. The ambulance service are on their way.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue8': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Back Flip': {
		'text': "<p>You land on the bride, crushing her horribly. Lying on top of her, your ribs broken, you realise why you never made the Olympics.</p>\n<p>There&#39;s two items on the floor. <a class=\"squiffy-link link-section\" data-section=\"Gum\" role=\"link\" tabindex=\"0\">Gum</a> or <a class=\"squiffy-link link-section\" data-section=\"Screwdriver\" role=\"link\" tabindex=\"0\">Screwdriver</a>?</p>",
		'passages': {
		},
	},
	'Screwdriver': {
		'text': "<p>You pick up the screwdriver, thinking it would make a good weapon.</p>\n<p>There&#39;s someone in front of you choking on gum. <a class=\"squiffy-link link-section\" data-section=\"First Aid\" role=\"link\" tabindex=\"0\">First Aid</a> or <a class=\"squiffy-link link-section\" data-section=\"Ignore\" role=\"link\" tabindex=\"0\">Ignore</a>?</p>",
		'passages': {
		},
	},
	'Ignore': {
		'text': "<p>The person asphyxiates in front of you. They deserved it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue9': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'First Aid': {
		'text': "<p>The gum is dislodged from their trachea. Arsehole.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue10': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Gum': {
		'text': "<p>You pick up the chewing gum.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue11': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Play the Trumpet': {
		'text': "<p>You can&#39;t, and regret ever attempting it.</p>\n<p>The building&#39;s on fire! <a class=\"squiffy-link link-section\" data-section=\"Call the Fire Service\" role=\"link\" tabindex=\"0\">Call the Fire Service</a> or <a class=\"squiffy-link link-section\" data-section=\"Watch Intently\" role=\"link\" tabindex=\"0\">Watch Intently</a>?</p>",
		'passages': {
		},
	},
	'Watch Intently': {
		'text': "<p>The fire crackles, and your eyes twinkle.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue12': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Call the Fire Service': {
		'text': "<p>What a hero.</p>\n<p>You&#39;re a karaoke singer. <a class=\"squiffy-link link-section\" data-section=\"Don't Stop Believing\" role=\"link\" tabindex=\"0\">Don&#39;t Stop Believing</a> or <a class=\"squiffy-link link-section\" data-section=\"My Heart Will Go On\" role=\"link\" tabindex=\"0\">My Heart Will Go On</a>?</p>",
		'passages': {
		},
	},
	'Don\'t Stop Believing': {
		'text': "<p>You&#39;ll never stop.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue13': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'My Heart Will Go On': {
		'text': "<p>Celine Dion provides the soundtrack for the tear fuelled evening at the bar.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue14': {
		'text': "<p>The Elders are displeased.</p>",
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
	'Barcelona': {
		'text': "<p>You meet the bear again at the airport. You&#39;re fairly civil towards one another.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue15': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Devon': {
		'text': "<p>You regret your decision within 5 minutes of arriving.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Start a Fire': {
		'text': "<p>You set a building on fire, you monster.</p>\n<p>You get tasered by a lunatic police officer. <a class=\"squiffy-link link-section\" data-section=\"Twitch\" role=\"link\" tabindex=\"0\">Twitch</a> or <a class=\"squiffy-link link-section\" data-section=\"Twitch Some More\" role=\"link\" tabindex=\"0\">Twitch Some More</a>?</p>",
		'passages': {
		},
	},
	'Twitch Some More': {
		'text': "<p>Your bandwidth is admirable.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Twitch': {
		'text': "<p>Your livestream attracts many viewers.</p>\n<p>It&#39;s the qualifying event for the Olympics. You&#39;re drunk. <a class=\"squiffy-link link-section\" data-section=\"Pommel Horse\" role=\"link\" tabindex=\"0\">Pommel Horse</a> or <a class=\"squiffy-link link-section\" data-section=\"Balance Beam\" role=\"link\" tabindex=\"0\">Balance Beam</a>?</p>",
		'passages': {
		},
	},
	'Pommel Horse': {
		'text': "<p>You stagger around the pommel horse and collapse.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue18\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue18': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Balance Beam': {
		'text': "<p>You&#39;re drunk. You can&#39;t even find the beam.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue19\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue19': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Run Away to the Hills': {
		'text': "<p>You start burrowing.</p>\n<p>You&#39;re a doctor. <a class=\"squiffy-link link-section\" data-section=\"Diagnose a Common Cold\" role=\"link\" tabindex=\"0\">Diagnose a Common Cold</a> or <a class=\"squiffy-link link-section\" data-section=\"TARDIS\" role=\"link\" tabindex=\"0\">TARDIS</a>?</p>",
		'passages': {
		},
	},
	'Diagnose a Common Cold': {
		'text': "<p>You arrive in 1942.</p>\n<p>You&#39;re an astronaut, and your ship is broken. <a class=\"squiffy-link link-section\" data-section=\"Seek Help\" role=\"link\" tabindex=\"0\">Seek Help</a> or <a class=\"squiffy-link link-section\" data-section=\"Await Rescue\" role=\"link\" tabindex=\"0\">Await Rescue</a>.</p>",
		'passages': {
		},
	},
	'Seek Help': {
		'text': "<p>You meet a helpful person. Hopefully they&#39;ll help!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue20\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue20': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Await Rescue': {
		'text': "<p>No one comes.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue21\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue21': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'TARDIS': {
		'text': "<p>The patient didn&#39;t make it.</p>\n<p>An astronaut asks for a screwdriver to fix his ship. <a class=\"squiffy-link link-section\" data-section=\"Give it to Her\" role=\"link\" tabindex=\"0\">Give it to Her</a> or <a class=\"squiffy-link link-section\" data-section=\"Lie\" role=\"link\" tabindex=\"0\">Lie</a></p>",
		'passages': {
		},
	},
	'Give it to Her': {
		'text': "<p>The astronaut returns to the stars.</p>\n<p>You&#39;re judging an incredibly sloppy pommel horse routine. Score: <a class=\"squiffy-link link-section\" data-section=\"Four\" role=\"link\" tabindex=\"0\">Four</a> or <a class=\"squiffy-link link-section\" data-section=\"Nine\" role=\"link\" tabindex=\"0\">Nine</a>?</p>",
		'passages': {
		},
	},
	'Nine': {
		'text': "<p>Your judging ability is brought before a tribunal.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue22\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue22': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Four': {
		'text': "<p>The unconcious gymnast doesn&#39;t reply.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue23\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue23': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Lie': {
		'text': "<p>The astronaut will never get home.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue24\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue24': {
		'text': "<p>The Elders are displeased.</p>",
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
	'Release the Lion': {
		'text': "<p>The lion tells you to fuck off as it saunters out of the zoo.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue25\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue25': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Release the Bear': {
		'text': "<p>The bear wanders off.</p>\n<p>You&#39;re strangling a man with rope. <a class=\"squiffy-link link-section\" data-section=\"Pull Tighter\" role=\"link\" tabindex=\"0\">Pull Tighter</a> or <a class=\"squiffy-link link-section\" data-section=\"Stop and Apologise\" role=\"link\" tabindex=\"0\">Stop and Apologise</a>?</p>",
		'passages': {
		},
	},
	'Stop and Apologise': {
		'text': "<p>The man understands and offers you a Custard Cream.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue26\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue26': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Pull Tighter': {
		'text': "<p>The man dies. What the fuck is wrong with you?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue27\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue27': {
		'text': "<p>The Elders are displeased.</p>",
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
	'Evacuate': {
		'text': "<p>You&#39;re saved!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue28\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue28': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Probably a False Alarm': {
		'text': "<p>Shame it wasn&#39;t.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue29\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue29': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Weed it': {
		'text': "<p>You&#39;re arrested for indecent exposure.</p>\n<p>You&#39;re captaining a ship. <a class=\"squiffy-link link-section\" data-section=\"Friendship\" role=\"link\" tabindex=\"0\">Friendship</a> or <a class=\"squiffy-link link-section\" data-section=\"Iceberg\" role=\"link\" tabindex=\"0\">Iceberg</a>?</p>",
		'passages': {
		},
	},
	'Friendship': {
		'text': "<p>Your life coach regrets their analogy.</p>\n<p>You&#39;re a bear, and witness a bank robbery. <a class=\"squiffy-link link-section\" data-section=\"Persue the Criminal\" role=\"link\" tabindex=\"0\">Persue the Criminal</a> or <a class=\"squiffy-link link-section\" data-section=\"Bear With It\" role=\"link\" tabindex=\"0\">Bear With It</a>?</p>",
		'passages': {
		},
	},
	'Persue the Criminal': {
		'text': "<p>You bound after the perp, letting out a loud roar as you do so.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue30\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue30': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Bear With It': {
		'text': "<p>You chuckle as you bound after the criminal.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue31\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue31': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Iceberg': {
		'text': "<p>You set a course for the iceberg. You&#39;re advised this was perhaps a mistake.</p>\n<p>You are the Crab King. <a class=\"squiffy-link link-section\" data-section=\"Demand a Joke\" role=\"link\" tabindex=\"0\">Demand a Joke</a> or <a class=\"squiffy-link link-section\" data-section=\"Demand Food\" role=\"link\" tabindex=\"0\">Demand Food</a>?</p>",
		'passages': {
		},
	},
	'Demand Food': {
		'text': "<p>You&#39;re served sushi. The worst kind of food.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue32\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue32': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Demand a Joke': {
		'text': "<p>The joke is shit.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue33\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue33': {
		'text': "<p>The Elders are displeased.</p>",
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
	'Call the Police': {
		'text': "<p>You do the noble and right thing. NERD.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue34\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue34': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Reassure the Boat': {
		'text': "<p>The boat&#39;s mood is buoyed by your words of encouragement.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue35\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue35': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Tame it': {
		'text': "<p>The bear is named Jeremy and fights crime for a living.</p>\n<p>You&#39;re a lawyer. The charge is murder. Is your client <a class=\"squiffy-link link-section\" data-section=\"Guilty\" role=\"link\" tabindex=\"0\">Guilty</a> or <a class=\"squiffy-link link-section\" data-section=\"Not Guilty\" role=\"link\" tabindex=\"0\">Not Guilty</a>?</p>",
		'passages': {
		},
	},
	'Not Guilty': {
		'text': "<p>Shame the jury doesn&#39;t agree.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue36\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue36': {
		'text': "<p>The Elders are displeased.</p>",
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
	'Go Home because Fishing\'s Shit': {
		'text': "<p>The right choice.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue37\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue37': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Catch a Fish': {
		'text': "<p>Well done! You sell it to the fishmongers&#39; for a terrible price.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue38\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue38': {
		'text': "<p>The Elders are displeased.</p>",
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
	'Police Report': {
		'text': "<p>You MORAL NERD.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue39\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue39': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Pull Out your Service Weapon': {
		'text': "<p>You&#39;re a fucking lunatic. The gun is wrestled from your hand by a crime fighting bear.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue40\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue40': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Eat Cheese': {
		'text': "<p>Halloumi is the reason you&#39;re no longer friends with Derek and Jennifer.</p>\n<p>The Crab King demands food. <a class=\"squiffy-link link-section\" data-section=\"Sushi\" role=\"link\" tabindex=\"0\">Sushi</a> or <a class=\"squiffy-link link-section\" data-section=\"Vegetable Crudites\" role=\"link\" tabindex=\"0\">Vegetable Crudites</a>?</p>",
		'passages': {
		},
	},
	'Sushi': {
		'text': "<p>The Crab King insists he&#39;s not a cannibal. You&#39;re sentenced to death by Sea Urchin.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue41\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue41': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Vegetable Crudites': {
		'text': "<p>&quot;What do you think I am, some kind of weirdo hummus eater?&quot; says the Crab King.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue42\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue42': {
		'text': "<p>The Elders are displeased.</p>",
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
		'text': "<p>She gets tased.</p>\n<p>An out of control boat is barreling towards you. <a class=\"squiffy-link link-section\" data-section=\"Jump\" role=\"link\" tabindex=\"0\">Jump</a> or <a class=\"squiffy-link link-section\" data-section=\"Relax it's Only a Barrel\" role=\"link\" tabindex=\"0\">Relax it&#39;s Only a Barrel</a>?</p>",
		'passages': {
		},
	},
	'Jump': {
		'text': "<p>It&#39;s a boat, did you HONESTLY think you&#39;d manage to jump fully clear of it?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue43\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue43': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Relax it\'s Only a Barrel': {
		'text': "<p>THAT&#39;S NOT WHAT THE SENTENCE SAID, YOU MORON.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue44\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue44': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Pepper Spray': {
		'text': "<p>The pepper is wet.</p>\n<p>The wedding has started. <a class=\"squiffy-link link-section\" data-section=\"I Do\" role=\"link\" tabindex=\"0\">I Do</a> or <a class=\"squiffy-link link-section\" data-section=\"Do I\" role=\"link\" tabindex=\"0\">Do I</a>?</p>",
		'passages': {
		},
	},
	'I Do': {
		'text': "<p>The wedding continues.</p>\n<p>You&#39;re an iceberg. A ship approaches. <a class=\"squiffy-link link-section\" data-section=\"Shit\" role=\"link\" tabindex=\"0\">Shit</a></p>",
		'passages': {
		},
	},
	'Do I': {
		'text': "<p>You&#39;re informed the wedding cannot continue until you say the vows correctly.</p>\n<p>You&#39;re a badger infantry officer. You spot squirrels on the horizon. <a class=\"squiffy-link link-section\" data-section=\"Sound the Alarm\" role=\"link\" tabindex=\"0\">Sound the Alarm</a> or <a class=\"squiffy-link link-section\" data-section=\"Defend the Bunker Yourself\" role=\"link\" tabindex=\"0\">Defend the Bunker Yourself</a>?</p>",
		'passages': {
		},
	},
	'Sound the Alarm': {
		'text': "<p>The Badgers clash with the Squirrels in a bloody fight for the hill.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue45\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue45': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Defend the Bunker Yourself': {
		'text': "<p>You hear the cries of your children as you&#39;re torn limb from limb by bloodthirsty Squirrels.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue46\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue46': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Shit': {
		'text': "<p>The ship hits you.</p>\n<p>You&#39;re in a joke shop. <a class=\"squiffy-link link-section\" data-section=\"Buy a Rubber Fish\" role=\"link\" tabindex=\"0\">Buy a Rubber Fish</a> or <a class=\"squiffy-link link-section\" data-section=\"Reconsider your Life Decisions\" role=\"link\" tabindex=\"0\">Reconsider your Life Decisions</a>?</p>",
		'passages': {
		},
	},
	'Buy a Rubber Fish': {
		'text': "<p>Why? WHY?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue47\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue47': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Reconsider your Life Decisions': {
		'text': "<p>Obviously. You&#39;re in a joke shop for Christ&#39;s sake.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue48\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue48': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Propose': {
		'text': "<p>The date agrees to marry you.</p>\n<p>You&#39;re on a boat. <a class=\"squiffy-link link-section\" data-section=\"Rock the Boat\" role=\"link\" tabindex=\"0\">Rock the Boat</a> or <a class=\"squiffy-link link-section\" data-section=\"Don't Rock the Boat Baby\" role=\"link\" tabindex=\"0\">Don&#39;t Rock the Boat Baby</a>?</p>",
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
	'Blue Flowers': {
		'text': "<p>The florist mutters something about a discount for poisonous berry bearing plants, but you&#39;re too excited about the prospect of a discount.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue49\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue49': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Gymnastics Routine': {
		'text': "<p>You&#39;re fiance doesn&#39;t speak to you anymore.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue50\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue50': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Sell the Sailor Drugs': {
		'text': "<p>You told him it was a cough sweet.</p>\n<p>You built a boat. <a class=\"squiffy-link link-section\" data-section=\"Noah\" role=\"link\" tabindex=\"0\">Noah</a> or <a class=\"squiffy-link link-section\" data-section=\"Titanic\" role=\"link\" tabindex=\"0\">Titanic</a>?</p>",
		'passages': {
		},
	},
	'Noah': {
		'text': "<p>No, ah!</p>\n<p>You meet a lion. <a class=\"squiffy-link link-section\" data-section=\"Say Hello\" role=\"link\" tabindex=\"0\">Say Hello</a> or <a class=\"squiffy-link link-section\" data-section=\"Trample it\" role=\"link\" tabindex=\"0\">Trample it</a>?</p>",
		'passages': {
		},
	},
	'Trample it': {
		'text': "<p>The lion is too large to trample. It tramples you.</p>\n<p>The squirrels torture you for information. <a class=\"squiffy-link link-section\" data-section=\"Deny Everything\" role=\"link\" tabindex=\"0\">Deny Everything</a> or <a class=\"squiffy-link link-section\" data-section=\"Give them What they Want\" role=\"link\" tabindex=\"0\">Give them What they Want</a>?</p>",
		'passages': {
		},
	},
	'Give them What they Want': {
		'text': "<p>You&#39;ve sided with the squirrels. The badgers have a bounty for your head.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue51\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue51': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Deny Everything': {
		'text': "<p>The squirrels don&#39;t believe you and remove another tooth before shattering your right kneecap with a crowbar.</p>\n<p>You&#39;re a waiter. <a class=\"squiffy-link link-section\" data-section=\"Deliver the Salad\" role=\"link\" tabindex=\"0\">Deliver the Salad</a> or <a class=\"squiffy-link link-section\" data-section=\"Spit in the Food\" role=\"link\" tabindex=\"0\">Spit in the Food</a>?</p>",
		'passages': {
		},
	},
	'Deliver the Salad': {
		'text': "<p>The customer insults you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue52\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue52': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Spit in the Food': {
		'text': "<p>Good call. The customer is an arsehole.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue53\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue53': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Say Hello': {
		'text': "<p>The lion isn&#39;t in the mood for conversation, and begins dancing.</p>\n<p>Your throat hurts. <a class=\"squiffy-link link-section\" data-section=\"Cough Sweet\" role=\"link\" tabindex=\"0\">Cough Sweet</a> or <a class=\"squiffy-link link-section\" data-section=\"Remove the Rope Around it\" role=\"link\" tabindex=\"0\">Remove the Rope Around it</a>?</p>",
		'passages': {
		},
	},
	'Remove the Rope Around it': {
		'text': "<p>The man strangling you apologises.</p>\n<p>The wedding reception is falling flat. <a class=\"squiffy-link link-section\" data-section=\"Dance Off\" role=\"link\" tabindex=\"0\">Dance Off</a> or <a class=\"squiffy-link link-section\" data-section=\"Speech\" role=\"link\" tabindex=\"0\">Speech</a>?</p>",
		'passages': {
		},
	},
	'Dance Off': {
		'text': "<p>The wedding recption livens up for a brief moment before the exertion causes your new father in law to have a heart attack on the dance floor. Your sister in law trips over him and breaks her leg.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue54\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue54': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Speech': {
		'text': "<p>Having not prepared anything, you tell a joke about the proiscuity of the bride. It is not well received.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue55\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue55': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Cough Sweet': {
		'text': "<p>Time for pottery class.</p>\n<p>The wildlife rebels and attacks. <a class=\"squiffy-link link-section\" data-section=\"Fight Back\" role=\"link\" tabindex=\"0\">Fight Back</a> or <a class=\"squiffy-link link-section\" data-section=\"Flee. They're too Strong\" role=\"link\" tabindex=\"0\">Flee. They&#39;re too Strong</a>?</p>",
		'passages': {
		},
	},
	'Flee. They\'re too Strong': {
		'text': "<p>They&#39;re too fast for you. You&#39;re captured and torn apart by ravenous squirrels.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue56\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue56': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Fight Back': {
		'text': "<p>The squirrels overcome you and carry you away.</p>\n<p>Your cruise ship has collided with an iceberg. <a class=\"squiffy-link link-section\" data-section=\"Swim for it\" role=\"link\" tabindex=\"0\">Swim for it</a> or <a class=\"squiffy-link link-section\" data-section=\"Put it in a Salad\" role=\"link\" tabindex=\"0\">Put it in a Salad</a>?</p>",
		'passages': {
		},
	},
	'Put it in a Salad': {
		'text': "<p>Delicious. Service!</p>\n<p>You&#39;re a lion. A human attempts to talk to you. <a class=\"squiffy-link link-section\" data-section=\"Dance\" role=\"link\" tabindex=\"0\">Dance</a> or <a class=\"squiffy-link link-section\" data-section=\"Tell it to Fuck Off\" role=\"link\" tabindex=\"0\">Tell it to Fuck Off</a>?</p>",
		'passages': {
		},
	},
	'Dance': {
		'text': "<p>Dancing is surprisingly hard for a lion. You&#39;d always assumed &#39;double the legs, double the dancing skill&#39;, but you&#39;ve been proven wrong by your clumsy attempt. The human seems surprised.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue57\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue57': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Tell it to Fuck Off': {
		'text': "<p>The human gets angry.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue58\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue58': {
		'text': "<p>The Elders are displeased.</p>",
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
	'Present the Rings': {
		'text': "<p>Precious.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue59\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue59': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Present the Presents': {
		'text': "<p>You drop them, breaking a casserole dish, towel rail and kettle.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue60\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue60': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Become Irate': {
		'text': "<p>You are mildly irritated by this outburst. The lion doesn&#39;t care.</p>\n<p>You&#39;re a squirrel. War has broken out on your hill. <a class=\"squiffy-link link-section\" data-section=\"Stay and Fight\" role=\"link\" tabindex=\"0\">Stay and Fight</a> or <a class=\"squiffy-link link-section\" data-section=\"Take your Family and Run\" role=\"link\" tabindex=\"0\">Take your Family and Run</a>?</p>",
		'passages': {
		},
	},
	'Stay and Fight': {
		'text': "<p>You join the infantry and tell your family to go without you. You miss them every day, but the Badgers are weakening. You may be home soon.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue61\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue61': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Take your Family and Run': {
		'text': "<p>Your fellow squirrels bully you for deserting, but you know it&#39;s for the best. You move to an adjacent hill, and find a nice tree.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue62\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue62': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Super Glue': {
		'text': "<p>You continue to feed your drug habit, looking forward to your meeting with your dealer.</p>\n<p>You are tasked with committing murder. <a class=\"squiffy-link link-section\" data-section=\"Accept\" role=\"link\" tabindex=\"0\">Accept</a> or <a class=\"squiffy-link link-section\" data-section=\"Reluctantly Accept\" role=\"link\" tabindex=\"0\">Reluctantly Accept</a>?</p>",
		'passages': {
		},
	},
	'Accept': {
		'text': "<p>You accept, making your way to your target&#39;s home.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue63\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue63': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Reluctantly Accept': {
		'text': "<p>You reluctantly accept and make your way to your target&#39;s home.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue64\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue64': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Titanic': {
		'text': "<p>Just the tip of the iceberg.</p>\n<p>You&#39;re living in the hills. <a class=\"squiffy-link link-section\" data-section=\"Become One With the Wildlife\" role=\"link\" tabindex=\"0\">Become One With the Wildlife</a> or <a class=\"squiffy-link link-section\" data-section=\"Dig your Way Out\" role=\"link\" tabindex=\"0\">Dig your Way Out</a>?</p>",
		'passages': {
		},
	},
	'Dig your Way Out': {
		'text': "<p>You scarbble at the dirt, hoping you have enough air to make it out.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue65\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue65': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Become One With the Wildlife': {
		'text': "<p>You join the Badger Resistance, participating in the ongoing war.</p>\n<p>You&#39;re a bank robber being persued by a bear named Jeremy. <a class=\"squiffy-link link-section\" data-section=\"Keep Running\" role=\"link\" tabindex=\"0\">Keep Running</a> or <a class=\"squiffy-link link-section\" data-section=\"Surrender\" role=\"link\" tabindex=\"0\">Surrender</a>?</p>",
		'passages': {
		},
	},
	'Surrender': {
		'text': "<p>You feel relief that the chase is over as Officer Jeremy Windsor, a bear, cuffs your arms behind your back and reads you your rights. </p>\n<p>The war wages on in Badger territory. The nights are long and cold. <a class=\"squiffy-link link-section\" data-section=\"Huddle for Warmth\" role=\"link\" tabindex=\"0\">Huddle for Warmth</a> or <a class=\"squiffy-link link-section\" data-section=\"Go for a Run\" role=\"link\" tabindex=\"0\">Go for a Run</a>?</p>",
		'passages': {
		},
	},
	'Huddle for Warmth': {
		'text': "<p>It looks cute when penguins do it. It&#39;s not when badgers do.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue66\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue66': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Go for a Run': {
		'text': "<p>You&#39;re shot and wounded in No Man&#39;s Land. Sad times.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue67\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue67': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Keep Running': {
		'text': "<p>You&#39;re safe. For now.</p>\n<p>The next station is: <a class=\"squiffy-link link-section\" data-section=\"Bank\" role=\"link\" tabindex=\"0\">Bank</a> or <a class=\"squiffy-link link-section\" data-section=\"Liverpool Street\" role=\"link\" tabindex=\"0\">Liverpool Street</a>?</p>",
		'passages': {
		},
	},
	'Liverpool Street': {
		'text': "<p>Mind the Gap.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue68\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue68': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Bank': {
		'text': "<p>The alarms ring in the bank as you abscond with bags of money. You hear the roar of a bear.</p>\n<p>You&#39;re a paramedic treating a man with a broken nose. <a class=\"squiffy-link link-section\" data-section=\"Nee-Naw\" role=\"link\" tabindex=\"0\">Nee-Naw</a> or <a class=\"squiffy-link link-section\" data-section=\"Discharge at Scene\" role=\"link\" tabindex=\"0\">Discharge at Scene</a>?</p>",
		'passages': {
		},
	},
	'Nee-Naw': {
		'text': "<p>As you mimic the sound of an ambulance, you&#39;re sectioned.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue69\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue69': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Discharge at Scene': {
		'text': "<p>You fire your gun. It hits a man.</p>\n<p>You&#39;re at a wedding, deathly allergic to their choice of blue flowers. <a class=\"squiffy-link link-section\" data-section=\"Sneeze During the Ceremony\" role=\"link\" tabindex=\"0\">Sneeze During the Ceremony</a> or <a class=\"squiffy-link link-section\" data-section=\"Allergy Tablets\" role=\"link\" tabindex=\"0\">Allergy Tablets</a>?</p>",
		'passages': {
		},
	},
	'Sneeze During the Ceremony': {
		'text': "<p>You sneeze at the point that the priest asks if anyone objects. Everyone stares.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue70\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue70': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Allergy Tablets': {
		'text': "<p>They aren&#39;t allergy tablets. You&#39;ve been roofied.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue71\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue71': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Don\'t Rock the Boat Baby': {
		'text': "<p>You walk calmly away from the boat; your anger in check.</p>\n<p>You&#39;re a sailor. <a class=\"squiffy-link link-section\" data-section=\"Buy the Drugs\" role=\"link\" tabindex=\"0\">Buy the Drugs</a> or <a class=\"squiffy-link link-section\" data-section=\"Buy the Pepsi\" role=\"link\" tabindex=\"0\">Buy the Pepsi</a>?</p>",
		'passages': {
		},
	},
	'Buy the Pepsi': {
		'text': "<p>You&#39;re harrassed for choosing Pepsi over the evidently far superior Coca-Cola.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue72\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue72': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Buy the Drugs': {
		'text': "<p>You&#39;re told it&#39;s a cough sweet.</p>\n<p>You&#39;re hit by a bullet. <a class=\"squiffy-link link-section\" data-section=\"Scream\" role=\"link\" tabindex=\"0\">Scream</a> or <a class=\"squiffy-link link-section\" data-section=\"Remove the Bullet\" role=\"link\" tabindex=\"0\">Remove the Bullet</a>?</p>",
		'passages': {
		},
	},
	'Scream': {
		'text': "<p>The obvious choice.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue73\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue73': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
	'Remove the Bullet': {
		'text': "<p>You rip the bullett from your skin, screaming while you do so. Everyone stares.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue74\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue74': {
		'text': "<p>The Elders are displeased.</p>",
		'passages': {
		},
	},
}
})();