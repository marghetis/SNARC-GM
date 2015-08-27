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
      return trials;
    };

    plugin.trial = function(display_element, trial) {

      // if any trial variables are functions
      // this evaluates the function and replaces
      // it with the output of the function
      trial = jsPsych.pluginAPI.evaluateFunctionParameters(trial);

      //var div = d3.select(display_element[0]);
      display_element.append('<svg id="fixation" style="overflow: visible;'
        + 'border:0px; width: 600px; height: 300px;"></svg>'
      );

      display_element.append('<svg id="formula" style="overflow: visible;'
        + 'border:0px; width: 600px; height: 300px;"></svg>'
      );

      dl = gmath.DerivationList.createFixedSingleLineDL('#formula',
        { eq: trial.equation
        , font_size: 75
        , normal_font: { family: 'monospace' }
        , italic_font: { family: 'monospace' }
        , v_align: 'equals'
        }
      );

      logger = new gmath.DLLogger(dl);
      var startTime = (new Date()).getTime();

      // add submit button
      display_element.append($('<p style="text-align:center">'
        + '<button type="button" id="jspsych-equation-submit" style="display:inline-block;'
        + 'background-color:transparent; border:0px; font-size:40px;'
        + 'font-color:black; padding:  0px 0px; font:monospace">*</button> </p>'
        )
      );

      $("#jspsych-equation-submit").html('SUBMIT');
      $("#jspsych-equation-submit").click(function() {
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

        display_element.html('');

        // next trial
        jsPsych.finishTrial();
      });

      //
      // var mouse_listener = function(e) {
      //     var rt = (new Date()).getTime() - start_time;
      //     display_element.unbind('click', mouse_listener);
      //     after_response({key: 'mouse', rt: rt});
      // };
      //
      // // check if key is 'mouse'
      // if (trial.cont_key == 'mouse') {
      //     display_element.click(mouse_listener);
      //     var start_time = (new Date()).getTime();
      // } else {
      //   jsPsych.pluginAPI.getKeyboardResponse({
      //     callback_function: after_response,
      //     valid_responses: trial.cont_key,
      //     rt_method: 'date',
      //     persist: false,
      //     allow_held_key: false
      //   });
      // }


    };

    return plugin;
  })();
})(jQuery);
