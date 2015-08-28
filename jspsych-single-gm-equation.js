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
      var trials = new Array(1);

      trials[0] = {};
      trials[0].type = "single-gm-equation";
      trials[0].equation = params.equation;
      trials[0].corr_equation = params.correct_form
      trials[0].timing_response = params.timing_response
      return trials;
    };

    plugin.trial = function(display_element, trial) {

      // if any trial variables are functions
      // this evaluates the function and replaces
      // it with the output of the function
      trial = jsPsych.pluginAPI.evaluateFunctionParameters(trial);

      display_element.append('<svg id="formula" style="overflow: visible;'
        + 'border:0px; width: 600px; height: 300px;"></svg>'
      );
      gmath.options.actions.blacklist = ['flip equation'] //disable ability to transpose sides of equation by clicking =
      dl = gmath.DerivationList.createFixedSingleLineDL('#formula',
        { eq: trial.equation
        , font_size: 75
        , dur_dragging: 0
        //, dur: 0
        , rubber_band_selection: false
        , enable_drag_to_join: false
        , show_node_targets: false
        , normal_font: { family: 'monospace' }
        , italic_font: { family: 'monospace' }
        , h_align: 'equals'
        }
      );

      logger = new gmath.DLLogger(dl);
      var startTime = (new Date()).getTime();
      console.log(trial.corr_equation)

      // check for correct answer
      dl.events.on('end-of-interaction', function(evt) {
        var current_equation = dl.getLastModel().to_ascii();
        console.log(current_equation);

        if (current_equation === trial.corr_equation) { // correct
            dl.getLastView().interactive(false);
            display_element.append('<p style="text-align:center;'
              + 'font-size:75px; font-color:black; font:monospace">Correct!</p>'
              );

            // measure response time
            var endTime = (new Date()).getTime();
            var response_time = endTime - startTime;

            // create object to hold responses
            var question_data = logger.data;

            // save data
            jsPsych.data.write({
              "rt": response_time,
              "events": JSON.stringify(logger.data)
            });

            // next trial
            clearTimeout(timeOutFunction); // stop the end-of-trial timer
            setTimeout(jsPsych.finishTrial, 750);
          }
      });

      // time out if too long
      timeOutFunction = setTimeout(timeIsUp, trial.timing_response);
      function timeIsUp() {
        display_element.html('<p style="'
          + 'font-size:40px; font-color:black; font:monospace">Time is up! Please respond faster.</p>'
          );

        // measure response time
        var endTime = (new Date()).getTime();
        var response_time = endTime - startTime;

        // create object to hold responses
        var question_data = logger.data;

        // save data
        jsPsych.data.write({
          "rt": "TimeOut",
          "events": JSON.stringify(logger.data)
        });

        // next trial
        setTimeout(jsPsych.finishTrial, 1000);
      }
    };

    return plugin;
  })();
})(jQuery);
