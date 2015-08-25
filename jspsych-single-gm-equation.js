/* single-gm-equation.js
 * Tyler Marghetis, adapted from jspsych-text.js and
 * jspsych-plugin-template by Josh de Leeuw
 *
 * This plugin displays an Graspable Math equation during the experiment.
 * It returns a JSON object with info on each event.
 *
 */

(function($) {
  jsPsych["single-gm-equation"] = (function() {

    var plugin = {};

    plugin.create = function(params) {

      params = jsPsych.pluginAPI.enforceArray(params, ['equation']);

      var trials = new Array(1);

      trials[0] = {};
      trials[0].type = "single-gm-equation";
      trials[0].equation = params.equation;
      return trials;
    };

    plugin.trial = function(display_element, block, trial) {

      // if any trial variables are functions
      // this evaluates the function and replaces
      // it with the output of the function
      trial = jsPsych.pluginAPI.evaluateFunctionParameters(trial);

      // set the HTML of the display target to replaced_text.
      var equation_to_display = trial.equation;
      display_element.load('single-gm-equation.html');
      var trial_data = {
			    type: trial.type,
			    trial_index: block.trial_idx,
			    // other values to save go here
			};
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
