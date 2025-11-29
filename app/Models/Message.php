<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'body',
        'sender_type',
        'sender_id',
        'is_read',
        // YENİ EKLENENLER:
        'type',
        'attachment_path',
    ];

    // JSON çıktısında otomatik olarak 'attachment_url' alanını göster
    protected $appends = ['attachment_url'];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender()
    {
        return $this->morphTo();
    }

    // Dosyanın tam http://... adresini döndüren Accessor
    public function getAttachmentUrlAttribute()
    {
        if ($this->attachment_path) {
            // Storage::url YERİNE url() kullanıyoruz.
            // Bu, 'http://site.com/attachments/dosya.jpg' döndürür.
            return url($this->attachment_path);
        }
        return null;
    }
}