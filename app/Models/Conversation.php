<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'website_id', // <--- BUNUN DA OLMASI ŞART
        'visitor_id',
        'status',
    ];

    public function website()
    {
        return $this->belongsTo(Website::class);
    }

    public function visitor()
    {
        return $this->belongsTo(Visitor::class);
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }
}