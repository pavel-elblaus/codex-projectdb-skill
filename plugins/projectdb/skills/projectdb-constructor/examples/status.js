!function ($, window, document, name){
	PDBW.module.set(name, {
		// обновление только переданного экземпляра из согласованных данных
		update: function ($module, data, callback){
			if(data == null) return callback();
			if(data.title != null) $(".status-title", $module).text(data.title);
			if(data.count != null) $(".status-count", $module).text(data.count);
			callback();
		}
	}, function (){
		// callback регистрации выполняется один раз
		$(document).on("click", "[module].custom-status [data-action=refresh]", function (){
			$(this).closest("[module]").trigger("status.refresh");
		});
	});
}(window.jQuery, window, document, "custom.status.twig");
