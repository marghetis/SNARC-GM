/* jspsych-fixation.click.js
 * by Tyler Marghetis, adapted from
 * jspsych-text.js by Josh de Leeuw
 *
 * This plugin displays a fixation asterisk and ends when it is clicked.
 *
 *
 *
 */

(function($) {
    jsPsych.text = (function() {

        var plugin = {};

        plugin.create = function(params) {

            params = jsPsych.pluginAPI.enforceArray(params, ['text','cont_key']);

            var trials = new Array(params.text.length);
            for (var i = 0; i < trials.length; i++) {
                trials[i] = {};
                trials[i].text = params.text[i]; // text of all trials
                trials[i].cont_key = params.cont_key || []; // keycode to press to advance screen, default is all keys.
            }
            return trials;
        };

        plugin.trial = function(display_element, trial) {

            // if any trial variables are functions
            // this evaluates the function and replaces
            // it with the output of the function
            trial = jsPsych.pluginAPI.evaluateFunctionParameters(trial);

            // set the HTML of the display target to replaced_text.
            display_element.html('<p style="text-align:center">' +
              + '<button type="button" id="fixation" style="display:inline-block;'
              + 'background-color:transparent; border:0px; font-size:40px;'
              + 'font-color:black; padding:  0px 0px; font:monospace;'
              + 'line-height: 70%; vertical-align: text-bottom;">*</button>'
              + '</p>');

            var after_response = function(info) {

                display_element.html(''); // clear the display

                save_data(info.key, info.rt);

                jsPsych.finishTrial();

            };

            var mouse_listener = function(e) {

                var rt = (new Date()).getTime() - start_time;

                display_element.unbind('click', mouse_listener);

                after_response({key: 'mouse', rt: rt});

            };

            // check if key is 'mouse'
            if (trial.cont_key == 'mouse') {
                display_element.click(mouse_listener);
                var start_time = (new Date()).getTime();
            } else {
              jsPsych.pluginAPI.getKeyboardResponse({
                callback_function: after_response,
                valid_responses: trial.cont_key,
                rt_method: 'date',
                persist: false,
                allow_held_key: false
              });
            }

            function save_data(key, rt) {
                jsPsych.data.write({
                    "rt": rt,
                    "key_press": key
                });
            }
        };

        return plugin;
    })();
})(jQuery);
