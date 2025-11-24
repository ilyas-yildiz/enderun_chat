<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    use HasFactory;

    // Mass Assignment koruması için izin verilen alanlar
    protected $fillable = [
        'conversation_id',
        'body',          // <--- Hatanın sebebi bu satırın olmamasıydı
        'sender_type',   // <--- Bu da eksikti
        'sender_id',     // <--- Bu da eksikti
        'is_read',
    ];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender()
    {
        return $this->morphTo();
    }
}