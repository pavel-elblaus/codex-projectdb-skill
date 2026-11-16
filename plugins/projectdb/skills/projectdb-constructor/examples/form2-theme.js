!function ($, window, document){
	// отдельное дополнение к базовому шаблону; методы и данные form2 не меняет
	$.fn.projectFormTheme = function (){
		return this.each(function (){
			// проектное оформление существующей разметки label и состояния полей
		});
	};
	// обновление include выполнено штатным form2
	$(document).on("form2.text.twig.update form2.textarea.twig.update", ".form2-index", function (){ $(this).projectFormTheme(); });
	$(document).on("focusin focusout input change", ".form2-index input,.form2-index textarea", function (){ $(this).closest(".form2-index").projectFormTheme(); });
	// onload общей оболочки вызывает $("body").projectFormTheme()
}(window.jQuery, window, document);
