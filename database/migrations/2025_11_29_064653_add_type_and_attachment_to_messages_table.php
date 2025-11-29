<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->string('type')->default('text'); // 'text', 'image', 'file'
            $table->string('attachment_path')->nullable(); // Dosyanın sunucudaki yolu
            // Metin alanı artık boş olabilir (sadece resim atılırsa)
            $table->text('body')->nullable()->change(); 
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['type', 'attachment_path']);
            $table->text('body')->nullable(false)->change();
        });
    }
};
